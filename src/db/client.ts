import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./sql";

/**
 * Runtime database client (server-only — never import from a client component).
 *
 * ADR-001 §17: the connection MUST be a restricted role
 * (`taployal_app`, NOBYPASSRLS). Connecting as the CranL `admin` superuser
 * silently bypasses every RLS policy and would make tenant isolation look
 * enforced while it is actually off. `assertSafeRuntimeRole()` fails closed.
 */

let _sql: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. CranL injects it when the database is connected to the app.",
    );
  }
  return url;
}

/** The role name the runtime must connect as. */
export const RUNTIME_DB_ROLE = "taployal_app";

/**
 * Fail-closed guard: refuse to serve on a role that can bypass row-level
 * security. Prevents the silent-no-isolation failure mode.
 */
export async function assertSafeRuntimeRole(
  sql: ReturnType<typeof postgres>,
): Promise<void> {
  const rows = await sql<{ usr: string; bypass: boolean; super: boolean }[]>`
    select current_user as usr, rolbypassrls as bypass, rolsuper as super
    from pg_roles where rolname = current_user
  `;
  const row = rows[0];
  if (!row) throw new Error("could not read the current database role");
  if (row.super || row.bypass) {
    throw new Error(
      `Unsafe database role "${row.usr}": superuser=${row.super} bypassrls=${row.bypass}. ` +
        `Runtime must connect as "${RUNTIME_DB_ROLE}" (NOBYPASSRLS).`,
    );
  }
}

export function getSql() {
  if (!_sql) {
    _sql = postgres(connectionString(), {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return _sql;
}

export function getDb() {
  if (!_db) {
    _db = drizzle(getSql(), { schema });
  }
  return _db;
}

/** DDL/migrations only. Never call from request handlers. */
export function getAdminSql() {
  return postgres(connectionString(), { max: 1, prepare: false });
}
