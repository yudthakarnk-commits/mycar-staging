-- REVIEW ONLY; NOT AUTHORIZED FOR PRODUCTION.
-- Compatibility rollback: preserve all records and private audit history.
-- Quiesce all clients before use; do not reenable RPC without reconciliation.
BEGIN;
SET LOCAL lock_timeout='10s';
LOCK TABLE public.mycar_records IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE rollback_records AS SELECT * FROM public.mycar_records;
CREATE TEMP TABLE rollback_state AS SELECT * FROM mycar_secure.account_state;
CREATE TEMP TABLE rollback_ops AS SELECT * FROM mycar_secure.operations;
CREATE TEMP TABLE rollback_snapshots AS SELECT * FROM mycar_secure.restore_snapshots;
REVOKE EXECUTE ON FUNCTION public.mycar_apply_changes(bigint,uuid,jsonb), public.mycar_get_sync_state(uuid), public.mycar_restore_preview(jsonb), public.mycar_restore_merge(bigint,uuid,jsonb,text), public.mycar_reverse_restore(bigint,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.mycar_records TO authenticated;
REVOKE DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.mycar_records FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE f regprocedure; BEGIN
 IF NOT has_table_privilege('authenticated','public.mycar_records','SELECT') OR NOT has_table_privilege('authenticated','public.mycar_records','INSERT') OR NOT has_table_privilege('authenticated','public.mycar_records','UPDATE') OR has_table_privilege('authenticated','public.mycar_records','TRUNCATE') THEN RAISE EXCEPTION 'Legacy ACL mismatch'; END IF;
 FOR f IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('mycar_apply_changes','mycar_get_sync_state','mycar_restore_preview','mycar_restore_merge','mycar_reverse_restore') LOOP
 IF has_function_privilege('authenticated',f::oid,'EXECUTE') OR has_function_privilege('anon',f::oid,'EXECUTE') THEN RAISE EXCEPTION 'RPC still exposed'; END IF;
 END LOOP;
 IF EXISTS(SELECT * FROM rollback_records EXCEPT SELECT * FROM public.mycar_records) OR EXISTS(SELECT * FROM public.mycar_records EXCEPT SELECT * FROM rollback_records) THEN RAISE EXCEPTION 'Data changed: public.mycar_records'; END IF;
 IF EXISTS(SELECT * FROM rollback_state EXCEPT SELECT * FROM mycar_secure.account_state) OR EXISTS(SELECT * FROM mycar_secure.account_state EXCEPT SELECT * FROM rollback_state) THEN RAISE EXCEPTION 'Data changed: mycar_secure.account_state'; END IF;
 IF EXISTS(SELECT * FROM rollback_ops EXCEPT SELECT * FROM mycar_secure.operations) OR EXISTS(SELECT * FROM mycar_secure.operations EXCEPT SELECT * FROM rollback_ops) THEN RAISE EXCEPTION 'Data changed: mycar_secure.operations'; END IF;
 IF EXISTS(SELECT * FROM rollback_snapshots EXCEPT SELECT * FROM mycar_secure.restore_snapshots) OR EXISTS(SELECT * FROM mycar_secure.restore_snapshots EXCEPT SELECT * FROM rollback_snapshots) THEN RAISE EXCEPTION 'Data changed: mycar_secure.restore_snapshots'; END IF;
END $$;
ROLLBACK;
