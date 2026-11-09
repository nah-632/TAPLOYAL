-- ============================================================================
-- 0002_rls_policies.sql
-- W3 — Tenant isolation on PostgreSQL RLS (native, not Supabase RLS)
-- Directive §5.1–§5.10, spec §2 / §9.
--
-- TWO LAYERS, BOTH REQUIRED:
--   1. Server-side authorization (withTenant(), W3.1) — the primary control.
--   2. Native PostgreSQL RLS — defense in depth, so a bug in layer 1 cannot
--      leak another merchant's rows.
--
-- CONTEXT CONTRACT (session variables, set by the server per request):
--   app.merchant_id      = the authenticated tenant's uuid
--   app.is_super_admin   = 'true' only on audited super-admin paths
--
-- FAIL-CLOSED: if app.merchant_id is unset, app_merchant_id() returns NULL,
-- the comparison is NULL, and NO rows match. Absence of context means zero
-- visibility — never "see everything".
-- ============================================================================

-- --- Helper: current tenant from the session context --------------------------
CREATE OR REPLACE FUNCTION public.app_merchant_id() RETURNS uuid
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT nullif(current_setting('app.merchant_id', true), '')::uuid
$$;

-- --- Helper: explicit, auditable super-admin context --------------------------
CREATE OR REPLACE FUNCTION public.app_is_super_admin() RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT coalesce(nullif(current_setting('app.is_super_admin', true), ''), 'false') = 'true'
$$;

REVOKE ALL ON FUNCTION public.app_merchant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_merchant_id() TO taployal_app;
GRANT EXECUTE ON FUNCTION public.app_is_super_admin() TO taployal_app;

-- ============================================================================
-- Per-table policies. FORCE is used everywhere so that even the table OWNER
-- is subject to the policy during normal operations.
-- ============================================================================

-- --- Tenant-owned tables keyed by merchant_id -------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','branches','loyalty_cards','customers','passes',
    'apple_pass_registrations','rewards','transactions','redemptions',
    'subscriptions','invoices','push_jobs','audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON public.%I
        FOR ALL TO taployal_app
        USING (public.app_is_super_admin() OR merchant_id = public.app_merchant_id())
        WITH CHECK (public.app_is_super_admin() OR merchant_id = public.app_merchant_id())
    $f$, t);
  END LOOP;
END
$$;

-- --- merchants: the row itself IS the tenant (keyed by id) -------------------
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.merchants;
CREATE POLICY tenant_isolation ON public.merchants
  FOR ALL TO taployal_app
  USING (public.app_is_super_admin() OR id = public.app_merchant_id())
  WITH CHECK (public.app_is_super_admin() OR id = public.app_merchant_id());

-- --- plans: global catalogue — readable by every tenant, never writable -----
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plans_global_read ON public.plans;
CREATE POLICY plans_global_read ON public.plans
  FOR SELECT TO taployal_app USING (true);
-- No INSERT/UPDATE/DELETE policy => with RLS enabled those are denied.
REVOKE INSERT, UPDATE, DELETE ON public.plans FROM taployal_app;

-- --- Rights on the new helper functions are not enough on their own: the
-- --- runtime role must not be able to change its own context silently.
-- --- Only the server (as owner) sets app.merchant_id.
DO $$
BEGIN
  IF has_function_privilege('taployal_app', 'public.app_merchant_id()', 'EXECUTE') IS NOT TRUE THEN
    RAISE EXCEPTION 'taployal_app cannot execute app_merchant_id()';
  END IF;
END
$$;

-- --- Verification self-check: every base table must have RLS enabled --------
DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(c.relname, ', ') INTO missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity IS NOT TRUE;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'RLS is not enabled on: %', missing;
  END IF;

  SELECT string_agg(c.relname, ', ') INTO missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relforcerowsecurity IS NOT TRUE;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'FORCE RLS is not enabled on: %', missing;
  END IF;
END
$$;
