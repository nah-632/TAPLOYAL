/**
 * Next.js instrumentation — runs once at server startup, before serving traffic.
 *
 * ADR-001 §17: the runtime MUST connect as `taployal_app` (NOBYPASSRLS).
 * CranL's "connect database to app" helper injects a connection URL that uses
 * the `admin` role, which is a superuser WITH BYPASSRLS — using it would
 * silently disable every row-level security policy while everything still
 * looked healthy. Rather than trust configuration, the process refuses to boot.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  // Imported lazily so the check cannot be tree-shaken out of the bundle.
  const { getSql, assertSafeRuntimeRole } = await import("@/db/client");
  const sql = getSql();
  try {
    await assertSafeRuntimeRole(sql);
    console.log("[startup] database role verified: RLS is enforced");
  } catch (error) {
    // Fail closed: never serve traffic with tenant isolation silently off.
    console.error("[startup] REFUSING TO START:", (error as Error).message);
    process.exit(1);
  }
}
