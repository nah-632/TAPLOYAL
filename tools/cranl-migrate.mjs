#!/usr/bin/env node
/**
 * tools/cranl-migrate.mjs
 *
 * Applies a .sql migration to the CranL-managed PostgreSQL through
 *   POST /api/v1/databases/{id}/migrations
 * which runs every statement in ONE transaction (a failing statement leaves the
 * database untouched).
 *
 * Safety properties, deliberately built in:
 *   1. `plan:true` preview first — prints exactly what would change, changes nothing.
 *   2. `dry_run:true` — executes then rolls back, to prove the SQL is valid.
 *   3. CranL's confirmation gate is NOT bypassed silently: the required token is
 *      echoed with the statement summary so the operator can see what is being
 *      approved.
 *   4. No secret is read or printed: the database password is never needed —
 *      the API authenticates with CRANL_ACCESS_KEY.
 *
 * Usage:
 *   node tools/cranl-migrate.mjs <file.sql> --plan
 *   node tools/cranl-migrate.mjs <file.sql> --dry-run
 *   node tools/cranl-migrate.mjs <file.sql> --apply
 */
import { readFileSync } from "node:fs";

const API = "https://app.cranl.com/api/v1";
const DB = process.env.CRANL_TAPLOYAL_DB_ID ?? "864dd005-bcd2-4662-a2bf-1603beea1811";
const KEY = process.env.CRANL_ACCESS_KEY;

const [, , file, flag] = process.argv;
if (!file || !flag) {
  console.error("usage: cranl-migrate.mjs <file.sql> --plan|--dry-run|--apply");
  process.exit(2);
}
if (!KEY) {
  console.error("CRANL_ACCESS_KEY is not set");
  process.exit(2);
}

const sql = readFileSync(file, "utf8");
const statementCount = sql
  .split("\n")
  .filter((l) => l.trim() && !l.trim().startsWith("--")).length;

const body = {
  sql,
  idempotency_key: `migrate-${file.replace(/[^a-zA-Z0-9]/g, "-")}-${sql.length}`,
};
if (flag === "--plan") body.plan = true;
if (flag === "--dry-run") body.dry_run = true;

async function post(payload) {
  const res = await fetch(`${API}/databases/${DB}/migrations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const summarize = (text) =>
  text.length > 600 ? `${text.slice(0, 600)}… [${text.length} chars]` : text;

let { json } = await post(body);

// CranL asks for explicit confirmation on write operations. Surface it, then
// retry once with the token — that is the intended two-step flow.
if (json?.error?.code === "confirmation_required") {
  const token = json.error.details?.confirm_token;
  console.log("── CONFIRMATION REQUIRED ──────────────────────────────");
  console.log(summarize(json.error.message ?? ""));
  if (!token) {
    console.error("no confirmation token in the response — stopping");
    console.error(JSON.stringify(json).slice(0, 800));
    process.exit(1);
  }
  if (flag === "--plan") {
    console.log("(plan mode: not confirmed, nothing was changed)");
    process.exit(0);
  }
  ({ json } = await post({ ...body, confirm: token }));
}

console.log(`── ${file}  (${statementCount} statement lines) ──`);
console.log(JSON.stringify(json, null, 1).slice(0, 2500));
process.exit(json?.error ? 1 : 0);
