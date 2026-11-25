-- PREPARED ONLY. Do not run before approved production change window.
BEGIN;
REVOKE TRUNCATE ON TABLE public.mycar_records FROM PUBLIC, anon, authenticated, service_role;
DO $$ BEGIN
 IF has_table_privilege('authenticated','public.mycar_records','TRUNCATE') OR has_table_privilege('anon','public.mycar_records','TRUNCATE') OR has_table_privilege('service_role','public.mycar_records','TRUNCATE') THEN RAISE EXCEPTION 'TRUNCATE privilege remains'; END IF;
 IF NOT has_table_privilege('authenticated','public.mycar_records','SELECT') OR NOT has_table_privilege('authenticated','public.mycar_records','INSERT') OR NOT has_table_privilege('authenticated','public.mycar_records','UPDATE') THEN RAISE EXCEPTION 'Legacy permissions changed'; END IF;
END $$;
-- Default is rollback for rehearsal. Explicitly approved change requires separately reviewed COMMIT.
ROLLBACK;
