-- REVIEW ONLY. NOT APPROVED FOR PRODUCTION EXECUTION.
-- Derived from tested local rehearsal, not yet verified against live STAGING definitions.
-- Deliberately ROLLBACK at end. Do not convert to COMMIT without separate approval.
-- Existing production updated_at trigger retained pending compatibility review.
BEGIN;
SET LOCAL timezone='UTC';
DO $$ BEGIN
 IF to_regclass('public.mycar_records') IS NULL OR to_regnamespace('mycar_secure') IS NOT NULL
 OR to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('auth.jwt()') IS NULL
 THEN RAISE EXCEPTION 'Unexpected target schema'; END IF;
END $$;
LOCK TABLE public.mycar_records IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE qa_cutover_baseline AS SELECT * FROM public.mycar_records;
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

DO $$ BEGIN
 IF EXISTS(SELECT * FROM qa_cutover_baseline EXCEPT SELECT * FROM public.mycar_records)
 OR EXISTS(SELECT * FROM public.mycar_records EXCEPT SELECT * FROM qa_cutover_baseline)
 THEN RAISE EXCEPTION 'Existing records changed'; END IF;
END $$;
ROLLBACK;
