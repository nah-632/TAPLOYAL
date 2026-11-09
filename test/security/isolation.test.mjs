#!/usr/bin/env node
/**
 * test/security/isolation.test.mjs — W3.4 / W3.5 / W3.6
 *
 * Proves tenant isolation on the REAL 15 tables, and proves the test itself is
 * capable of failing.
 *
 * WHY THIS SHAPE:
 *   Every CranL API call connects as `admin` (superuser + BYPASSRLS), which
 *   bypasses RLS entirely. The only way to exercise the policies is
 *   `SET ROLE taployal_app` inside the request — and the write path returns no
 *   result set, so measurements are written to a table and read back.
 *
 * PHASES
 *   1. seed      two tenants (A, B), one row per tenant table
 *   2. probe     as taployal_app + tenant A: count own rows, and attempt B's
 *   3. no-ctx    as taployal_app with no tenant context   -> 0 (fails closed)
 *   4. super     as taployal_app + is_super_admin=true    -> sees both
 *   5. canary    RLS disabled on one table -> the suite MUST report a leak
 *
 * Exit 0 only if every assertion held AND the canary was detected.
 *
 * DIRECTORY NOTE: this lives in `test/`, not `tests/` — `tests` is un-creatable
 * in this container (see docs/adr/ADR-001 §17).
 */
const API = "https://app.cranl.com/api/v1";
const DB = process.env.CRANL_TAPLOYAL_DB_ID ?? "864dd005-bcd2-4662-a2bf-1603beea1811";
const KEY = process.env.CRANL_ACCESS_KEY;

const MA = "aaaaaaaa-0000-0000-0000-00000000000a";
const MB = "bbbbbbbb-0000-0000-0000-00000000000b";

/** Tables scoped by merchant_id, in FK-safe insert order. */
const SCOPED = [
  "users", "branches", "loyalty_cards", "customers", "passes",
  "apple_pass_registrations", "rewards", "transactions", "redemptions",
  "subscriptions", "invoices", "push_jobs", "audit_logs",
];

const other = (t) => (t === MA ? MB : MA);

const CHILD_FIRST = [
  "redemptions", "transactions", "apple_pass_registrations", "push_jobs",
  "invoices", "subscriptions", "passes", "rewards", "customers",
  "loyalty_cards", "branches", "users", "audit_logs",
];

const SEED = `
${CHILD_FIRST.map((t) => `DELETE FROM ${t} WHERE merchant_id IN ('${MA}','${MB}');`).join("\n")}
-- audit_logs.merchant_id is ON DELETE SET NULL on purpose (an audit trail must
-- outlive the tenant row), so rows orphaned by an earlier merchant delete are
-- not caught by the merchant_id filter above. Remove them by their fixed ids.
DELETE FROM audit_logs WHERE id IN
  ('ae000000-0000-0000-0000-000000000001','be000000-0000-0000-0000-000000000001');
DELETE FROM merchants WHERE id IN ('${MA}','${MB}');

INSERT INTO merchants(id,name,slug,status) VALUES
  ('${MA}','Tenant A','tenant-a','active'),
  ('${MB}','Tenant B','tenant-b','active');

INSERT INTO plans(code,price_monthly,max_customers,max_staff,max_branches,allows_location_notifications) VALUES
  ('free',0,100,2,1,false),('basic',15.000,2000,10,3,true),('pro',39.000,NULL,NULL,NULL,true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO users(id,email,role,merchant_id) VALUES
  ('a1000000-0000-0000-0000-000000000001','a@tenant-a.test','merchant_owner','${MA}'),
  ('b1000000-0000-0000-0000-000000000001','b@tenant-b.test','merchant_owner','${MB}');

INSERT INTO branches(id,merchant_id,name) VALUES
  ('a2000000-0000-0000-0000-000000000001','${MA}','A branch'),
  ('b2000000-0000-0000-0000-000000000001','${MB}','B branch');

INSERT INTO loyalty_cards(id,merchant_id,name,mode,stamps_required,status) VALUES
  ('a3000000-0000-0000-0000-000000000001','${MA}','A card','stamps',8,'published'),
  ('b3000000-0000-0000-0000-000000000001','${MB}','B card','stamps',8,'published');

INSERT INTO customers(id,merchant_id,full_name,phone) VALUES
  ('a4000000-0000-0000-0000-000000000001','${MA}','A customer','+97300000001'),
  ('b4000000-0000-0000-0000-000000000001','${MB}','B customer','+97300000002');

INSERT INTO passes(id,merchant_id,card_id,customer_id,serial_number,auth_token_hash,web_view_token_hash,balance) VALUES
  ('a5000000-0000-0000-0000-000000000001','${MA}','a3000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001','SER-A','h1','h2',3),
  ('b5000000-0000-0000-0000-000000000001','${MB}','b3000000-0000-0000-0000-000000000001','b4000000-0000-0000-0000-000000000001','SER-B','h3','h4',5);

INSERT INTO apple_pass_registrations(id,merchant_id,pass_id,device_library_id,push_token) VALUES
  ('a6000000-0000-0000-0000-000000000001','${MA}','a5000000-0000-0000-0000-000000000001','devA','tokA'),
  ('b6000000-0000-0000-0000-000000000001','${MB}','b5000000-0000-0000-0000-000000000001','devB','tokB');

INSERT INTO rewards(id,merchant_id,card_id,name,cost) VALUES
  ('a7000000-0000-0000-0000-000000000001','${MA}','a3000000-0000-0000-0000-000000000001','A reward',8),
  ('b7000000-0000-0000-0000-000000000001','${MB}','b3000000-0000-0000-0000-000000000001','B reward',8);

INSERT INTO transactions(id,merchant_id,pass_id,branch_id,type,amount,idempotency_key) VALUES
  ('a8000000-0000-0000-0000-000000000001','${MA}','a5000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000001','earn',1,'idem-A-1'),
  ('b8000000-0000-0000-0000-000000000001','${MB}','b5000000-0000-0000-0000-000000000001','b2000000-0000-0000-0000-000000000001','earn',1,'idem-B-1');

INSERT INTO redemptions(id,merchant_id,transaction_id,reward_id,pass_id) VALUES
  ('a9000000-0000-0000-0000-000000000001','${MA}','a8000000-0000-0000-0000-000000000001','a7000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000001'),
  ('b9000000-0000-0000-0000-000000000001','${MB}','b8000000-0000-0000-0000-000000000001','b7000000-0000-0000-0000-000000000001','b5000000-0000-0000-0000-000000000001');

INSERT INTO subscriptions(id,merchant_id,plan_id,status)
  SELECT 'aa000000-0000-0000-0000-000000000001','${MA}',id,'active' FROM plans WHERE code='free';
INSERT INTO subscriptions(id,merchant_id,plan_id,status)
  SELECT 'bb000000-0000-0000-0000-000000000001','${MB}',id,'active' FROM plans WHERE code='free';

INSERT INTO invoices(id,merchant_id,subscription_id,amount,status) VALUES
  ('ac000000-0000-0000-0000-000000000001','${MA}','aa000000-0000-0000-0000-000000000001',0,'paid'),
  ('bc000000-0000-0000-0000-000000000001','${MB}','bb000000-0000-0000-0000-000000000001',0,'paid');

INSERT INTO push_jobs(id,merchant_id,pass_id,platform) VALUES
  ('ad000000-0000-0000-0000-000000000001','${MA}','a5000000-0000-0000-0000-000000000001','apple'),
  ('bd000000-0000-0000-0000-000000000001','${MB}','b5000000-0000-0000-0000-000000000001','apple');

INSERT INTO audit_logs(id,merchant_id,action) VALUES
  ('ae000000-0000-0000-0000-000000000001','${MA}','seeded'),
  ('be000000-0000-0000-0000-000000000001','${MB}','seeded');
`;

/** Probes executed as taployal_app. `own` must be visible, `other` never. */
function probes() {
  const rows = [];
  for (const t of SCOPED) {
    rows.push(`INSERT INTO _rls_probe(probe,visible) SELECT '${t}:own', count(*) FROM ${t};`);
    rows.push(
      `INSERT INTO _rls_probe(probe,visible) SELECT '${t}:other', count(*) FROM ${t} WHERE merchant_id = '${MB}';`,
    );
  }
  rows.push(`INSERT INTO _rls_probe(probe,visible) SELECT 'merchants:own', count(*) FROM merchants;`);
  rows.push(
    `INSERT INTO _rls_probe(probe,visible) SELECT 'merchants:other', count(*) FROM merchants WHERE id = '${MB}';`,
  );
  rows.push(`INSERT INTO _rls_probe(probe,visible) SELECT 'plans:own', count(*) FROM plans;`);
  return rows.join("\n");
}

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

async function readProbes() {
  const out = await runSql("SELECT probe, visible FROM _rls_probe ORDER BY probe", false);
  return new Map(out.rows.map((r) => [r.probe, Number(r.visible)]));
}

async function main() {
  const results = [];
  const check = (name, actual, expected) => {
    const ok = actual === expected;
    results.push({ name, actual, expected, ok });
    console.log(`  ${ok ? "✓" : "✗"} ${name} = ${actual} (expected ${expected})`);
    return ok;
  };

  console.log("\n──── PHASE 1: seed two tenants ────");
  await runSql(`
    CREATE TABLE IF NOT EXISTS _rls_probe(probe text, visible bigint);
    TRUNCATE _rls_probe;
    GRANT INSERT, SELECT, TRUNCATE ON _rls_probe TO taployal_app;
    ${SEED}
    RESET ROLE;
  `);
  console.log("  seeded tenant A and tenant B");

  console.log("\n──── PHASE 2: as taployal_app, tenant A ────");
  await runSql(`SET ROLE taployal_app; SET app.merchant_id = '${MA}';\n${probes()}\nRESET ROLE;`);
  let p = await readProbes();
  for (const t of SCOPED) {
    check(`${t}:own`, p.get(`${t}:own`), 1);
    check(`${t}:other`, p.get(`${t}:other`), 0);
  }
  check("merchants:own", p.get("merchants:own"), 1);
  check("merchants:other", p.get("merchants:other"), 0);
  check("plans:own (global catalogue)", p.get("plans:own"), 3);

  console.log("\n──── PHASE 3: no tenant context (must fail closed) ────");
  await runSql(`TRUNCATE _rls_probe;\nSET ROLE taployal_app;\n${probes()}\nRESET ROLE;`);
  p = await readProbes();
  // `plans` is the global price catalogue and is intentionally world-readable
  // (policy: USING(true), SELECT-only). It holds no tenant data, so it is the
  // single documented exception — asserted explicitly below rather than
  // silently excluded.
  const tenantScopedNoCtx = [...p.entries()].filter(
    ([k]) => k.endsWith(":own") && k !== "plans:own",
  );
  const anyVisible = tenantScopedNoCtx.reduce((a, [, v]) => a + v, 0);
  const leakedTables = tenantScopedNoCtx.filter(([, v]) => v > 0).map(([k]) => k);
  if (leakedTables.length) console.log(`    leaking tables: ${leakedTables.join(", ")}`);
  check("tenant-scoped rows visible with NO context", anyVisible, 0);
  check("global catalogue still readable (by design)", p.get("plans:own"), 3);

  console.log("\n──── PHASE 4: explicit super-admin context ────");
  await runSql(`
    TRUNCATE _rls_probe;
    SET ROLE taployal_app;
    SET app.is_super_admin = 'true';
    INSERT INTO _rls_probe(probe,visible) SELECT 'super:merchants', count(*) FROM merchants;
    INSERT INTO _rls_probe(probe,visible) SELECT 'super:customers', count(*) FROM customers;
    RESET ROLE;
  `);
  p = await readProbes();
  check("super:merchants (sees both)", p.get("super:merchants"), 2);
  check("super:customers (sees both)", p.get("super:customers"), 2);

  console.log("\n──── PHASE 5: CANARY — prove the suite can FAIL ────");
  await runSql(
    "ALTER TABLE customers NO FORCE ROW LEVEL SECURITY; ALTER TABLE customers DISABLE ROW LEVEL SECURITY;",
  );
  await runSql(`
    TRUNCATE _rls_probe;
    SET ROLE taployal_app;
    SET app.merchant_id = '${MA}';
    INSERT INTO _rls_probe(probe,visible) SELECT 'customers:other', count(*) FROM customers WHERE merchant_id = '${MB}';
    RESET ROLE;
  `);
  p = await readProbes();
  const leaked = p.get("customers:other");
  const canaryDetected = leaked > 0;
  console.log(`  ${canaryDetected ? "✓" : "✗"} with RLS disabled, cross-tenant rows appeared: ${leaked} (expected > 0)`);
  console.log("  → proves phases 2–4 measure real enforcement, not a vacuous pass");

  await runSql(
    "ALTER TABLE customers ENABLE ROW LEVEL SECURITY; ALTER TABLE customers FORCE ROW LEVEL SECURITY;",
  );
  console.log("  restored RLS on customers");

  const failed = results.filter((r) => !r.ok);
  console.log("\n════ SUMMARY ════");
  console.log(`assertions: ${results.length} · failed: ${failed.length} · canary detected: ${canaryDetected}`);
  for (const f of failed) console.log(`  FAIL ${f.name}: got ${f.actual}, expected ${f.expected}`);
  process.exit(failed.length === 0 && canaryDetected ? 0 : 1);
}

main().catch((e) => {
  console.error("harness error:", e.message);
  process.exit(1);
});
