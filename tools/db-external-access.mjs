#!/usr/bin/env node
/**
 * tools/db-external-access.mjs
 *
 * Toggles the public port on the CranL-managed database.
 *
 * WHY THIS EXISTS:
 *   CranL's external access gives the database a PUBLIC port, and that port has
 *   NO TLS (verified: SSL_NOT_SUPPORTED). Anything connecting from outside the
 *   platform crosses the internet in cleartext. Production never needs it — the
 *   app and the database are in the same region and talk over the internal host.
 *
 *   It IS required by the platform's own API operations: `run_migration`,
 *   `snapshot_database` and `import_sql` (and therefore `POST /databases/{id}/query`),
 *   which is how the security suites are executed from a development machine.
 *
 * So: keep it OFF by default. Turn it ON only to run the database-level suites,
 * then turn it OFF again.
 *
 * Usage:
 *   node tools/db-external-access.mjs status
 *   node tools/db-external-access.mjs on
 *   node tools/db-external-access.mjs off
 */
const API = "https://app.cranl.com/api/v1";
const DB = process.env.CRANL_TAPLOYAL_DB_ID ?? "864dd005-bcd2-4662-a2bf-1603beea1811";
const KEY = process.env.CRANL_ACCESS_KEY;

if (!KEY) {
  console.error("CRANL_ACCESS_KEY is not set");
  process.exit(2);
}

async function call(path, method, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json().catch(() => null);
}

function report(d) {
  const db = d?.database ?? d;
  if (db?.external_port !== undefined) {
    const open = db.external_port !== null && db.external_port !== undefined;
    console.log(`external access: ${open ? "ON" : "OFF"}${open ? ` (public port ${db.external_port})` : ""}`);
  } else {
    console.log("may not have been exposed");
  }
  console.log("  internal host:", db?.internal_host ?? "?");
}

const mode = process.argv[2] ?? "status";

if (mode === "status") {
  report(await call(`/databases/${DB}`, "GET"));
  process.exit(0);
}

if (mode !== "on" && mode !== "off") {
  console.error("usage: db-external-access.mjs [status|on|off]");
  process.exit(2);
}

const enabled = mode === "on";
if (enabled) {
  console.warn("⚠  enabling a PUBLIC, NON-TLS Postgres port — dev only; turn it off when done");
}

let result = await call(`/databases/${DB}/external-access`, "PUT", { enabled });
if (result?.error?.code === "confirmation_required") {
  result = await call(`/databases/${DB}/external-access`, "PUT", {
    enabled,
    confirm: result.error.details?.confirm_token,
  });
}
if (result?.error) {
  console.error("FAILED:", result.error.code, "-", result.error.message);
  process.exit(1);
}
report(result);
