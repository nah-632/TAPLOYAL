#!/usr/bin/env node
/**
 * tools/cranl-query.mjs — run SQL against the CranL-managed database.
 *
 *   node tools/cranl-query.mjs "select 1"            # read-only
 *   node tools/cranl-query.mjs --write "..."         # allowed to change data
 *
 * Never needs the database password: the API authenticates with
 * CRANL_ACCESS_KEY. Writes still pass CranL's confirmation gate.
 */
const API = "https://app.cranl.com/api/v1";
const DB = process.env.CRANL_TAPLOYAL_DB_ID ?? "864dd005-bcd2-4662-a2bf-1603beea1811";
const KEY = process.env.CRANL_ACCESS_KEY;

const args = process.argv.slice(2);
const write = args.includes("--write");
const sql = args.filter((a) => a !== "--write").join(" ");

if (!sql) {
  console.error("usage: cranl-query.mjs [--write] \"SQL\"");
  process.exit(2);
}

async function run(payload) {
  const res = await fetch(`${API}/databases/${DB}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

let out = await run({ query: sql, write });

if (out?.error?.code === "confirmation_required") {
  const token = out.error.details?.confirm_token;
  if (!token) {
    console.error(JSON.stringify(out).slice(0, 600));
    process.exit(1);
  }
  out = await run({ query: sql, write, confirm: token });
}

if (out?.error) {
  console.error("ERROR:", out.error.code, "-", out.error.message);
  process.exit(1);
}
console.log(JSON.stringify(out, null, 1));
