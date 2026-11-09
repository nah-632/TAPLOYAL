#!/usr/bin/env node
/**
 * test/security/transaction-engine.test.mjs
 *
 * Proves the atomic core against real PostgreSQL on CranL:
 *   A. idempotency  — the same key never records a second transaction
 *   B. undo         — restores the balance through a compensating row
 *   C. tenant guard — tenant A cannot move tenant B's balance
 *   D. atomicity    — a failed transaction leaves no ledger row AND no job
 *   E. queue        — claim() never hands the same job to two workers
 *   F. RLS          — tenant A cannot see tenant B's jobs
 *
 * Run as taployal_app via SET ROLE (every API call connects as the admin
 * superuser, which would bypass RLS and make A–F meaningless).
 */
const API = "https://app.cranl.com/api/v1";
const DB = process.env.CRANL_TAPLOYAL_DB_ID ?? "864dd005-bcd2-4662-a2bf-1603beea1811";
const KEY = process.env.CRANL_ACCESS_KEY;

const MA = "aaaaaaaa-0000-0000-0000-00000000000a";
const MB = "bbbbbbbb-0000-0000-0000-00000000000b";
const PASS_A = "a5000000-0000-0000-0000-000000000001";
const PASS_B = "b5000000-0000-0000-0000-000000000001";

async function call(payload) {
  const res = await fetch(`${API}/databases/${DB}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => null);
}

async function runSql(sql, write = true) {
  let json = await call({ query: sql, write });
  if (json?.error?.code === "confirmation_required") {
    json = await call({ query: sql, write, confirm: json.error.details?.confirm_token });
  }
  if (json?.error) throw new Error(`${json.error.code}: ${json.error.message}`);
  return json;
}

async function readProbe() {
  const out = await runSql(
    "SELECT name, value FROM _engine_probe ORDER BY id",
    false,
  );
  return out.rows;
}

const results = [];
function check(name, actual, expected) {
  const ok = String(actual) === String(expected);
  results.push({ name, actual, expected, ok });
  console.log(`  ${ok ? "✓" : "✗"} ${name} = ${actual} (expected ${expected})`);
}

const FIXTURE = `
DELETE FROM job_queue WHERE merchant_id IN ('${MA}','${MB}');
DELETE FROM redemptions WHERE merchant_id IN ('${MA}','${MB}');
DELETE FROM transactions WHERE merchant_id IN ('${MA}','${MB}');
DELETE FROM passes WHERE merchant_id IN ('${MA}','${MB}');
DELETE FROM customers WHERE merchant_id IN ('${MA}','${MB}');
DELETE FROM loyalty_cards WHERE merchant_id IN ('${MA}','${MB}');
DELETE FROM branches WHERE merchant_id IN ('${MA}','${MB}');
DELETE FROM users WHERE merchant_id IN ('${MA}','${MB}');
DELETE FROM merchants WHERE id IN ('${MA}','${MB}');

INSERT INTO merchants(id,name,slug,status) VALUES
  ('${MA}','Tenant A','tenant-a','active'), ('${MB}','Tenant B','tenant-b','active');
INSERT INTO loyalty_cards(id,merchant_id,name,mode,stamps_required,status) VALUES
  ('a3000000-0000-0000-0000-000000000001','${MA}','A card','stamps',8,'published'),
  ('b3000000-0000-0000-0000-000000000001','${MB}','B card','stamps',8,'published');
INSERT INTO customers(id,merchant_id,full_name,phone) VALUES
  ('a4000000-0000-0000-0000-000000000001','${MA}','A customer','+97300000001'),
  ('b4000000-0000-0000-0000-000000000001','${MB}','B customer','+97300000002');
INSERT INTO passes(id,merchant_id,card_id,customer_id,serial_number,auth_token_hash,web_view_token_hash,balance) VALUES
  ('${PASS_A}','${MA}','a3000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001','SER-A','h1','h2',3),
  ('${PASS_B}','${MB}','b3000000-0000-0000-0000-000000000001','b4000000-0000-0000-0000-000000000001','SER-B','h3','h4',5);
`;

/** Calls the engine as the tenant and records the outcome, catching any raise. */
function callEngine(label, tenant, passId, type, amount, key) {
  return `
DO $$
BEGIN
  PERFORM app_record_transaction('${tenant}'::uuid, '${passId}'::uuid, '${type}', ${amount}, '${key}');
  INSERT INTO _engine_probe(name, value) VALUES ('${label}', 'ok');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _engine_probe(name, value) VALUES ('${label}', 'raised:' || SQLSTATE);
END $$;`;
}

async function main() {
  console.log("\n──── PHASE 0: fixture ────");
  await runSql(`
    CREATE TABLE IF NOT EXISTS _engine_probe(id serial primary key, name text, value text);
    TRUNCATE _engine_probe;
    GRANT INSERT, SELECT, TRUNCATE ON _engine_probe TO taployal_app;
    GRANT USAGE, SELECT ON SEQUENCE _engine_probe_id_seq TO taployal_app;
    ${FIXTURE}
    RESET ROLE;
  `);
  console.log("  tenant A pass balance = 3, tenant B pass balance = 5");

  console.log("\n──── PHASE 1: earn, idempotency, undo (as taployal_app, tenant A) ────");
  await runSql(`
    TRUNCATE _engine_probe;
    SET ROLE taployal_app;
    SET app.merchant_id = '${MA}';
    ${callEngine("earn_first", MA, PASS_A, "earn", 1, "K1")}
    ${callEngine("earn_duplicate", MA, PASS_A, "earn", 1, "K1")}
    ${callEngine("earn_second", MA, PASS_A, "earn", 1, "K2")}
    ${callEngine("undo_second", MA, PASS_A, "undo", -1, "K3")}
    INSERT INTO _engine_probe(name,value) SELECT 'balance', balance::text FROM passes WHERE id='${PASS_A}';
    INSERT INTO _engine_probe(name,value) SELECT 'tx_count', count(*)::text FROM transactions WHERE merchant_id='${MA}';
    INSERT INTO _engine_probe(name,value) SELECT 'jobs_for_pass_a', count(*)::text FROM job_queue WHERE payload->>'pass_id'='${PASS_A}';
    RESET ROLE;
  `);
  let r = Object.fromEntries((await readProbe()).map((x) => [x.name, x.value]));

  check("earn_first", r.earn_first, "ok");
  check("earn_duplicate (same key)", r.earn_duplicate, "ok");
  check("earn_second (new key)", r.earn_second, "ok");
  check("undo_second", r.undo_second, "ok");
  // 3 ->(+1)=4 ->(dup, no change)=4 ->(+1)=5 ->(undo -1)=4
  check("final balance", r.balance, "4");
  // first, second, undo => 3 rows. The duplicate MUST NOT have added a fourth.
  check("ledger rows (duplicate must not add one)", r.tx_count, "3");
  // one job per real balance change; the duplicate must not enqueue.
  check("wallet jobs enqueued", r.jobs_for_pass_a, "3");

  console.log("\n──── PHASE 2: cross-tenant attack (tenant A touching tenant B's pass) ────");
  await runSql(`
    TRUNCATE _engine_probe;
    SET ROLE taployal_app;
    SET app.merchant_id = '${MA}';
    ${callEngine("cross_tenant", MA, PASS_B, "earn", 5, "X1")}
    SET app.is_super_admin = 'true';
    INSERT INTO _engine_probe(name,value) SELECT 'b_balance', balance::text FROM passes WHERE id='${PASS_B}';
    INSERT INTO _engine_probe(name,value) SELECT 'b_tx', count(*)::text FROM transactions WHERE merchant_id='${MB}';
    RESET ROLE;
  `);
  r = Object.fromEntries((await readProbe()).map((x) => [x.name, x.value]));
  // P0002 = no_data_found (raised by `RAISE EXCEPTION ... USING ERRCODE`).
  // The message is intentionally generic so it never discloses whether the row
  // exists for another tenant.
  check("cross-tenant call raised", r.cross_tenant, "raised:P0002");
  check("tenant B balance untouched", r.b_balance, "5");
  check("tenant B ledger untouched", r.b_tx, "0");

  console.log("\n──── PHASE 3: atomicity — failed transaction leaves NO ledger row and NO job ────");
  await runSql(`
    TRUNCATE _engine_probe;
    SET ROLE taployal_app;
    SET app.merchant_id = '${MA}';
    ${callEngine("overdraft", MA, PASS_A, "redeem", -999, "K4")}
    INSERT INTO _engine_probe(name,value) SELECT 'balance_after_fail', balance::text FROM passes WHERE id='${PASS_A}';
    INSERT INTO _engine_probe(name,value) SELECT 'tx_after_fail', count(*)::text FROM transactions WHERE merchant_id='${MA}';
    INSERT INTO _engine_probe(name,value) SELECT 'jobs_after_fail', count(*)::text FROM job_queue WHERE merchant_id='${MA}';
    INSERT INTO _engine_probe(name,value) SELECT 'K4_absent', count(*)::text FROM transactions WHERE idempotency_key='K4';
    RESET ROLE;
  `);
  r = Object.fromEntries((await readProbe()).map((x) => [x.name, x.value]));
  check("overdraft raised", r.overdraft, "raised:23514"); // check_violation
  check("balance unchanged after failure", r.balance_after_fail, "4");
  check("no ledger row for failed attempt", r.tx_after_fail, "3");
  check("no job enqueued for failed attempt", r.jobs_after_fail, "3");
  check("idempotency key K4 not consumed", r.K4_absent, "0");

  console.log("\n──── PHASE 4: queue claim never duplicates work ────");
  await runSql(`
    TRUNCATE _engine_probe;
    SET ROLE taployal_app;
    SET app.is_super_admin = 'true';
    INSERT INTO _engine_probe(name,value) SELECT 'claim1', id::text FROM app_job_claim(1,'w1');
    INSERT INTO _engine_probe(name,value) SELECT 'claim2', id::text FROM app_job_claim(1,'w2');
    INSERT INTO _engine_probe(name,value) SELECT 'distinct_claimed', count(DISTINCT value)::text FROM _engine_probe WHERE name LIKE 'claim%';
    RESET ROLE;
  `);
  r = Object.fromEntries((await readProbe()).map((x) => [x.name, x.value]));
  check("two claims returned two rows", r.distinct_claimed, "2");
  const c1 = (await readProbe()).filter((x) => x.name.startsWith("claim"));
  check("claim1 != claim2", c1[0].value !== c1[1].value, true);

  console.log("\n──── PHASE 5: RLS on job_queue — tenant B sees none of tenant A's jobs ────");
  await runSql(`
    TRUNCATE _engine_probe;
    SET ROLE taployal_app;
    SET app.merchant_id = '${MB}';
    INSERT INTO _engine_probe(name,value) SELECT 'b_sees_jobs', count(*)::text FROM job_queue;
    RESET ROLE;
  `);
  r = Object.fromEntries((await readProbe()).map((x) => [x.name, x.value]));
  check("tenant B sees 0 of tenant A's jobs", r.b_sees_jobs, "0");

  const failed = results.filter((x) => !x.ok);
  console.log("\n════ SUMMARY ════");
  console.log(`assertions: ${results.length} · failed: ${failed.length}`);
  for (const f of failed) console.log(`  FAIL ${f.name}: got ${f.actual}, expected ${f.expected}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error("harness error:", e.message);
  process.exit(1);
});
