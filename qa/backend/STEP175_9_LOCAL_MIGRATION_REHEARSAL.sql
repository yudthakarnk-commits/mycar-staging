\set ON_ERROR_STOP on
BEGIN;
SET LOCAL timezone='UTC';
DO $$ BEGIN
 IF current_database() <> 'mycar_recovery' OR to_regclass('public.mycar_records') IS NULL OR to_regnamespace('mycar_secure') IS NOT NULL THEN RAISE EXCEPTION 'Wrong or already migrated test database'; END IF;
 IF (SELECT count(*) FROM public.mycar_records) <> 254 OR (SELECT count(*) FROM auth.users) <> 3 THEN RAISE EXCEPTION 'Expected local recovered baseline'; END IF;
END $$;
CREATE TEMP TABLE qa_baseline AS SELECT * FROM public.mycar_records;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claims',true)::jsonb $$;
CREATE SCHEMA mycar_secure;
CREATE TABLE mycar_secure.account_state(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE mycar_secure.operations(user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,request_id uuid NOT NULL,operation text NOT NULL CHECK(operation IN ('apply','restore','reverse')),input_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,request_id));
CREATE TABLE mycar_secure.restore_snapshots(user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,request_id uuid NOT NULL,records jsonb NOT NULL,revision_before bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,request_id),FOREIGN KEY(user_id,request_id) REFERENCES mycar_secure.operations(user_id,request_id) DEFERRABLE INITIALLY DEFERRED);
REVOKE ALL ON SCHEMA mycar_secure FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA mycar_secure FROM PUBLIC,anon,authenticated,service_role;
-- STAGING-tested function definitions; not a standalone initial schema migration.
-- Do not execute in production before approved backend migration and cutover gates.
CREATE OR REPLACE FUNCTION public.mycar_apply_changes(p_expected_revision bigint, p_request_id uuid, p_operations jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE u uuid; rev bigint; h text; existing mycar_secure.operations%ROWTYPE; result jsonb; n int;
BEGIN
 u:=auth.uid();
 IF u IS NULL OR (auth.jwt()->'is_anonymous') IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
 IF p_request_id IS NULL OR p_expected_revision IS NULL OR jsonb_typeof(p_operations) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 n:=jsonb_array_length(p_operations);
 IF n NOT BETWEEN 1 AND 50 OR pg_column_size(p_operations)>524288 THEN RAISE EXCEPTION 'INVALID_BATCH_SIZE'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_operations) AS e(value)
  WHERE jsonb_typeof(value) <> 'object' OR coalesce(value->>'collection','') NOT IN ('vehicles','fuel','maintenance','tax','trips','other')
  OR coalesce(value->>'record_id','') !~ '^[A-Za-z0-9_-]{1,128}$'
  OR jsonb_typeof(value->'deleted') IS DISTINCT FROM 'boolean'
  OR (value->>'deleted')='false' AND (jsonb_typeof(value->'payload') IS DISTINCT FROM 'object' OR value->'payload'->>'id' IS DISTINCT FROM value->>'record_id')
 ) THEN RAISE EXCEPTION 'INVALID_OPERATION'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_operations) AS e(value) GROUP BY value->>'collection',value->>'record_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'DUPLICATE_RECORD'; END IF;
 h:=md5(p_operations::text);
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,713121));
 SELECT * INTO existing FROM mycar_secure.operations WHERE user_id=u AND request_id=p_request_id;
 IF FOUND THEN
  IF existing.input_hash<>h OR existing.operation<>'apply' THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF;
  RETURN existing.result;
 END IF;
 INSERT INTO mycar_secure.account_state(user_id) VALUES(u) ON CONFLICT DO NOTHING;
 SELECT revision INTO rev FROM mycar_secure.account_state WHERE user_id=u FOR UPDATE;
 IF rev<>p_expected_revision THEN RAISE EXCEPTION 'STALE_REVISION: current=% expected=%',rev,p_expected_revision; END IF;
 INSERT INTO public.mycar_records(user_id,collection,record_id,payload,deleted,updated_at)
 SELECT u, value->>'collection',value->>'record_id',
 CASE WHEN (value->>'deleted')::boolean THEN '{}'::jsonb ELSE value->'payload' END,
 (value->>'deleted')::boolean,now()
 FROM jsonb_array_elements(p_operations) e(value)
 ON CONFLICT(user_id,collection,record_id) DO UPDATE SET payload=EXCLUDED.payload,deleted=EXCLUDED.deleted,updated_at=EXCLUDED.updated_at;
 UPDATE mycar_secure.account_state SET revision=rev+1,updated_at=now() WHERE user_id=u;
 result:=jsonb_build_object('ok',true,'operation','apply','revision',rev+1,'request_id',p_request_id,'count',n);
 INSERT INTO mycar_secure.operations(user_id,request_id,operation,input_hash,result) VALUES(u,p_request_id,'apply',h,result);
 RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION public.mycar_get_sync_state(p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE u uuid; rev bigint; op jsonb;
BEGIN
 u:=auth.uid();
 IF u IS NULL OR (auth.jwt()->'is_anonymous') IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
 SELECT revision INTO rev FROM mycar_secure.account_state WHERE user_id=u;
 IF p_request_id IS NOT NULL THEN SELECT result INTO op FROM mycar_secure.operations WHERE user_id=u AND request_id=p_request_id; END IF;
 RETURN jsonb_build_object('revision',coalesce(rev,0),'request',op,'restore_barrier_revision',coalesce((SELECT max((o.result->>'revision')::bigint) FROM mycar_secure.operations o WHERE o.user_id=u AND o.operation IN ('restore','reverse')),0));
END $function$
;
CREATE OR REPLACE FUNCTION public.mycar_restore_merge(p_expected_revision bigint, p_request_id uuid, p_backup jsonb, p_confirmation_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE u uuid; rev bigint; h text; existing mycar_secure.operations%ROWTYPE; result jsonb; v jsonb;
BEGIN
 u:=auth.uid();
 IF u IS NULL OR (auth.jwt()->'is_anonymous') IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
 IF p_request_id IS NULL OR p_expected_revision IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 v:=public.mycar_restore_preview(p_backup);
 h:=md5(p_backup::text);
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,713121));
 SELECT * INTO existing FROM mycar_secure.operations WHERE user_id=u AND request_id=p_request_id;
 IF FOUND THEN
  IF existing.input_hash<>h OR existing.operation<>'restore' THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF;
  RETURN existing.result;
 END IF;
 INSERT INTO mycar_secure.account_state(user_id) VALUES(u) ON CONFLICT DO NOTHING;
 SELECT revision INTO rev FROM mycar_secure.account_state WHERE user_id=u FOR UPDATE;
 IF rev<>p_expected_revision THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
 IF p_confirmation_token IS DISTINCT FROM md5(p_backup::text||':'||rev::text) THEN RAISE EXCEPTION 'INVALID_CONFIRMATION'; END IF;
 result:=jsonb_build_object('ok',true,'operation','restore','revision',rev+1,'request_id',p_request_id,'count',jsonb_array_length(p_backup));
 INSERT INTO mycar_secure.operations(user_id,request_id,operation,input_hash,result) VALUES(u,p_request_id,'restore',h,result);
 INSERT INTO mycar_secure.restore_snapshots(user_id,request_id,revision_before,records)
 SELECT u,p_request_id,rev,coalesce(jsonb_agg(jsonb_build_object('collection',collection,'record_id',record_id,'payload',payload,'deleted',deleted,'updated_at',updated_at) ORDER BY collection,record_id),'[]'::jsonb) FROM public.mycar_records WHERE user_id=u;
 INSERT INTO public.mycar_records(user_id,collection,record_id,payload,deleted,updated_at)
 SELECT u,value->>'collection',value->>'record_id',value->'payload',coalesce((value->>'deleted')::boolean,false),now() FROM jsonb_array_elements(p_backup) e(value)
 ON CONFLICT(user_id,collection,record_id) DO UPDATE SET payload=EXCLUDED.payload,deleted=EXCLUDED.deleted,updated_at=EXCLUDED.updated_at;
 UPDATE mycar_secure.account_state SET revision=rev+1,updated_at=now() WHERE user_id=u;
 RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION public.mycar_restore_preview(p_backup jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE u uuid; rev bigint; n int;
BEGIN
 u:=auth.uid();
 IF u IS NULL OR (auth.jwt()->'is_anonymous') IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
 IF jsonb_typeof(p_backup) IS DISTINCT FROM 'array' OR pg_column_size(p_backup)>1048576 THEN RAISE EXCEPTION 'INVALID_BACKUP'; END IF;
 n:=jsonb_array_length(p_backup);
 IF n>500 THEN RAISE EXCEPTION 'BACKUP_TOO_LARGE'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_backup) e(value) WHERE jsonb_typeof(value)<>'object'
 OR coalesce(value->>'collection','') NOT IN ('vehicles','fuel','maintenance','tax','trips','other')
 OR coalesce(value->>'record_id','') !~ '^[A-Za-z0-9_-]{1,128}$'
 OR jsonb_typeof(value->'payload') IS DISTINCT FROM 'object'
 OR value->'payload'->>'id' IS DISTINCT FROM value->>'record_id'
 OR (value ? 'deleted' AND jsonb_typeof(value->'deleted')<>'boolean')
 ) THEN RAISE EXCEPTION 'INVALID_BACKUP_ENTRY'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_backup) e(value) GROUP BY value->>'collection',value->>'record_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'DUPLICATE_BACKUP_ENTRY'; END IF;
 SELECT revision INTO rev FROM mycar_secure.account_state WHERE user_id=u;
 rev:=coalesce(rev,0);
 RETURN jsonb_build_object('revision',rev,'records',n,'mode','merge-only','confirmation_token',md5(p_backup::text||':'||rev::text));
END $function$
;
CREATE OR REPLACE FUNCTION public.mycar_reverse_restore(p_expected_revision bigint, p_request_id uuid, p_original_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE u uuid; rev bigint; h text; existing mycar_secure.operations%ROWTYPE; prior jsonb; result jsonb;
BEGIN
 u:=auth.uid();
 IF u IS NULL OR (auth.jwt()->'is_anonymous') IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
 IF p_request_id IS NULL OR p_expected_revision IS NULL OR p_original_request_id IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 h:=md5(p_original_request_id::text);
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,713121));
 SELECT * INTO existing FROM mycar_secure.operations WHERE user_id=u AND request_id=p_request_id;
 IF FOUND THEN
  IF existing.input_hash<>h OR existing.operation<>'reverse' THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF;
  RETURN existing.result;
 END IF;
 SELECT records INTO prior FROM mycar_secure.restore_snapshots WHERE user_id=u AND request_id=p_original_request_id;
 IF prior IS NULL THEN RAISE EXCEPTION 'RESTORE_SNAPSHOT_NOT_FOUND'; END IF;
 INSERT INTO mycar_secure.account_state(user_id) VALUES(u) ON CONFLICT DO NOTHING;
 SELECT revision INTO rev FROM mycar_secure.account_state WHERE user_id=u FOR UPDATE;
 IF rev<>p_expected_revision THEN RAISE EXCEPTION 'STALE_REVISION'; END IF;
 IF NOT EXISTS (SELECT 1 FROM mycar_secure.operations WHERE user_id=u AND request_id=p_original_request_id AND operation='restore' AND (mycar_secure.operations.result->>'revision')::bigint=rev)
 THEN RAISE EXCEPTION 'REVERSE_REQUIRES_IMMEDIATE_RESTORE_REVISION'; END IF;
 result:=jsonb_build_object('ok',true,'operation','reverse','revision',rev+1,'request_id',p_request_id,'reversed_request_id',p_original_request_id);
 INSERT INTO mycar_secure.operations(user_id,request_id,operation,input_hash,result) VALUES(u,p_request_id,'reverse',h,result);
 DELETE FROM public.mycar_records WHERE user_id=u;
 INSERT INTO public.mycar_records(user_id,collection,record_id,payload,deleted,updated_at)
 SELECT u,value->>'collection',value->>'record_id',value->'payload',(value->>'deleted')::boolean,(value->>'updated_at')::timestamptz FROM jsonb_array_elements(prior) e(value);
 UPDATE mycar_secure.account_state SET revision=rev+1,updated_at=now() WHERE user_id=u;
 RETURN result;
END $function$
;
DO $$ DECLARE fn regprocedure; BEGIN
 FOR fn IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('mycar_apply_changes','mycar_get_sync_state','mycar_restore_merge','mycar_restore_preview','mycar_reverse_restore') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',fn);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',fn);
 IF has_function_privilege('anon',fn::oid,'EXECUTE') OR NOT has_function_privilege('authenticated',fn::oid,'EXECUTE') THEN RAISE EXCEPTION 'RPC grants failed'; END IF;
 END LOOP;
END $$;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.mycar_records FROM PUBLIC,anon,authenticated,service_role;
DO $$ BEGIN
 IF has_table_privilege('authenticated','public.mycar_records','INSERT') OR has_table_privilege('authenticated','public.mycar_records','UPDATE') OR has_table_privilege('authenticated','public.mycar_records','TRUNCATE') OR NOT has_table_privilege('authenticated','public.mycar_records','SELECT') THEN RAISE EXCEPTION 'Legacy lockdown failed'; END IF;
 IF has_schema_privilege('authenticated','mycar_secure','USAGE') THEN RAISE EXCEPTION 'Private schema exposed'; END IF;
END $$;
SELECT 'PASS: migration and grants' result;
-- Use synthetic owners, no writes to real restored owner rows.
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000175'),('00000000-0000-4000-8000-000000000176');
SET LOCAL ROLE authenticated;
DO $$ DECLARE a uuid:='00000000-0000-4000-8000-000000000175'; b uuid:='00000000-0000-4000-8000-000000000176'; r uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); z uuid:=gen_random_uuid(); ops jsonb:='[{"collection":"other","record_id":"qa175","deleted":false,"payload":{"id":"qa175","v":1}}]'; backup jsonb:='[{"collection":"other","record_id":"qa175","payload":{"id":"qa175","v":2}}]'; x jsonb; y jsonb; before_rows jsonb;
BEGIN
PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'is_anonymous',true)::text,true);
BEGIN PERFORM public.mycar_get_sync_state(null); RAISE EXCEPTION 'Anonymous accepted'; EXCEPTION WHEN SQLSTATE '28000' THEN NULL; END;
PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'is_anonymous',false)::text,true);
IF EXISTS(SELECT 1 FROM public.mycar_records) THEN RAISE EXCEPTION 'Owner leakage'; END IF;
IF (public.mycar_get_sync_state(null)->>'revision')::int<>0 THEN RAISE EXCEPTION 'Initial revision'; END IF;
x:=public.mycar_apply_changes(0,r,ops); y:=public.mycar_apply_changes(0,r,ops);
IF x IS DISTINCT FROM y OR (x->>'revision')::int<>1 THEN RAISE EXCEPTION 'Apply/retry'; END IF;
BEGIN PERFORM public.mycar_apply_changes(0,gen_random_uuid(),ops); RAISE EXCEPTION 'Expected stale'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'STALE_REVISION%' THEN RAISE; END IF; END;
SELECT jsonb_agg(to_jsonb(t)) INTO before_rows FROM public.mycar_records t;
x:=public.mycar_restore_preview(backup);
IF (public.mycar_get_sync_state(null)->>'revision')::int<>1 THEN RAISE EXCEPTION 'Preview changed revision'; END IF;
y:=public.mycar_restore_merge(1,m,backup,x->>'confirmation_token');
IF (y->>'revision')::int<>2 OR NOT EXISTS(SELECT 1 FROM public.mycar_records WHERE payload->>'v'='2') THEN RAISE EXCEPTION 'Merge failed'; END IF;
PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',b,'is_anonymous',false)::text,true);
IF EXISTS(SELECT 1 FROM public.mycar_records) OR public.mycar_get_sync_state(r)->'request' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Cross owner leakage'; END IF;
BEGIN PERFORM public.mycar_reverse_restore(0,z,m); RAISE EXCEPTION 'Cross owner reverse accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'RESTORE_SNAPSHOT_NOT_FOUND' THEN RAISE; END IF; END;
PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'is_anonymous',false)::text,true);
y:=public.mycar_reverse_restore(2,z,m);
IF (y->>'revision')::int<>3 OR (SELECT jsonb_agg(to_jsonb(t)) FROM public.mycar_records t) IS DISTINCT FROM before_rows THEN RAISE EXCEPTION 'Reverse mismatch'; END IF;
PERFORM public.mycar_apply_changes(3,gen_random_uuid(),'[{"collection":"other","record_id":"qa175","deleted":true}]');
IF NOT EXISTS(SELECT 1 FROM public.mycar_records WHERE record_id='qa175' AND deleted) THEN RAISE EXCEPTION 'Tombstone failed'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS: RPC auth, apply, retry, stale, preview, merge, isolation, reverse, tombstone' result;
DO $$ BEGIN
 IF EXISTS(SELECT * FROM qa_baseline EXCEPT SELECT * FROM public.mycar_records) OR EXISTS(SELECT * FROM public.mycar_records WHERE user_id IN (SELECT user_id FROM qa_baseline) EXCEPT SELECT * FROM qa_baseline) THEN RAISE EXCEPTION 'Original data changed'; END IF;
END $$;
SELECT 'PASS: original 254 records unchanged' result;
ROLLBACK;
DO $$ BEGIN
 IF to_regnamespace('mycar_secure') IS NOT NULL OR (SELECT count(*) FROM public.mycar_records)<>254 OR (SELECT count(*) FROM auth.users)<>3 OR NOT has_table_privilege('authenticated','public.mycar_records','INSERT') THEN RAISE EXCEPTION 'Rollback verification failed'; END IF;
END $$;
SELECT 'PASS: migration rollback; original database preserved' result;
