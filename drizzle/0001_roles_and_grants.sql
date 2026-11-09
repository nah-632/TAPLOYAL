-- ============================================================================
-- 0001_roles_and_grants.sql
-- W1.4 — Restricted runtime database role (ADR-001 §17, directive §5.8/§5.9)
--
-- WHY THIS EXISTS:
--   The CranL-managed `admin` role has rolsuper=true AND rolbypassrls=true.
--   Any connection as `admin` silently bypasses EVERY row-level security
--   policy — tenant isolation would look enforced while being off.
--
--   Therefore the application must NOT connect as `admin`. It connects as
--   `taployal_app`: no superuser, no createrole, no createdb, no bypassrls.
--
-- NOTE: created with LOGIN but NO password. A password is set at deploy time
--   from CranL secrets, so no secret ever passes through a development shell.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taployal_app') THEN
    CREATE ROLE taployal_app LOGIN
      NOSUPERUSER NOCREATEROLE NOCREATEDB NOINHERIT NOREPLICATION NOBYPASSRLS;
  ELSE
    ALTER ROLE taployal_app
      NOSUPERUSER NOCREATEROLE NOCREATEDB NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

-- Least privilege: DML only. No TRUNCATE, no REFERENCES, no TRIGGER, no DDL.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM taployal_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM taployal_app;
REVOKE ALL ON SCHEMA public FROM taployal_app;

GRANT USAGE ON SCHEMA public TO taployal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO taployal_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO taployal_app;

-- Future tables must not silently inherit the wrong privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO taployal_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO taployal_app;

-- Explicitly deny the two operations that would let a bug destroy tenant data.
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM taployal_app;

-- Verification self-check: the migration fails if the properties are wrong.
DO $$
DECLARE r record;
BEGIN
  SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
    INTO r FROM pg_roles WHERE rolname = 'taployal_app';
  IF r IS NULL THEN
    RAISE EXCEPTION 'taployal_app role was not created';
  END IF;
  IF r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb THEN
    RAISE EXCEPTION
      'taployal_app has unsafe attributes: super=% bypassrls=% createrole=% createdb=%',
      r.rolsuper, r.rolbypassrls, r.rolcreaterole, r.rolcreatedb;
  END IF;
END
$$;
