#!/usr/bin/env node
/**
 * test/security/onboarding.test.mjs
 *
 * Question this answers: the merchants/users policies are
 *   "... OR id = app_merchant_id()" / "... OR merchant_id = app_merchant_id()"
 * so how can a brand-new merchant ever be created — and does the mechanism
 * accidentally become a blanket allow?
 *
 * Proof, as taployal_app:
 *   1. scoped to a FRESH server-generated id, creating that merchant + its owner
 *      row SUCCEEDS,
 *   2. in the same session, inserting a merchant under a DIFFERENT id FAILS
 *      (so it is not a blanket allow),
 *   3. while scoped to the new id, an existing tenant's rows stay invisible,
 *   4. cleanup.
 */
const API = "https://app.cranl.com/api/v1";
const DB = process.env.CRANL_TAPLOYAL_DB_ID ?? "864dd005-bcd2-4662-a2bf-1603beea1811";
const KEY = process.env.CRANL_ACCESS_KEY;

const OTHER = "ffffffff-0000-0000-0000-00000000000f";
const USER_ID = "f1000000-0000-0000-0000-00000000000f";

/** A fresh id per run, exactly as the server would generate it (randomUUID). */
const NEW = crypto.randomUUID();

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
  const out = await runSql("SELECT name, value FROM _onb_probe ORDER BY id", false);
  return Object.fromEntries(out.rows.map((r) => [r.name, r.value]));
}

const results = [];
function check(name, actual, expected) {
  const ok = String(actual) === String(expected);
  results.push({ name, actual, expected, ok });
  console.log(`  ${ok ? "✓" : "✗"} ${name} = ${actual} (expected ${expected})`);
}

async function main() {
  console.log(`\nfresh merchant id for this run: ${NEW}`);

  console.log("\n──── PHASE 1: onboarding as taployal_app, scoped to the NEW id ────");
  await runSql(`
    CREATE TABLE IF NOT EXISTS _onb_probe(id serial primary key, name text, value text);
    TRUNCATE _onb_probe;
    GRANT INSERT, SELECT, TRUNCATE ON _onb_probe TO taployal_app;
    GRANT USAGE, SELECT ON SEQUENCE _onb_probe_id_seq TO taployal_app;
    RESET ROLE;
    SET ROLE taployal_app;
    SET app.merchant_id = '${NEW}';

    DO $$ BEGIN
      INSERT INTO merchants(id,name,slug,status,owner_user_id)
        VALUES ('${NEW}','Fresh Merchant','fresh-${NEW.slice(0, 8)}','active','${USER_ID}');
      INSERT INTO _onb_probe(name,value) VALUES ('create_merchant','ok');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO _onb_probe(name,value) VALUES ('create_merchant','raised:'||SQLSTATE);
    END $$;

    DO $$ BEGIN
      INSERT INTO users(id,email,role,merchant_id,is_active)
        VALUES ('${USER_ID}','fresh-${NEW.slice(0, 8)}@taployal.test','merchant_owner','${NEW}',true);
      INSERT INTO _onb_probe(name,value) VALUES ('create_owner_row','ok');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO _onb_probe(name,value) VALUES ('create_owner_row','raised:'||SQLSTATE);
    END $$;

    RESET ROLE;
  `);
  let r = await readProbe();
  check("create merchant under a fresh id", r.create_merchant, "ok");
  check("create owner profile row", r.create_owner_row, "ok");

  console.log("\n──── PHASE 2: negative control — same session, a DIFFERENT id ────");
  await runSql(`
    TRUNCATE _onb_probe;
    SET ROLE taployal_app;
    SET app.merchant_id = '${NEW}';
    DO $$ BEGIN
      INSERT INTO merchants(id,name,slug,status) VALUES ('${OTHER}','Smuggled','smuggled-x','active');
      INSERT INTO _onb_probe(name,value) VALUES ('sneak_other_merchant','LEAK');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO _onb_probe(name,value) VALUES ('sneak_other_merchant','raised:'||SQLSTATE);
    END $$;

    DO $$ BEGIN
      INSERT INTO users(id,email,role,merchant_id,is_active)
        VALUES ('ffffffff-0000-0000-0000-0000000000ff','smuggled@x.test','merchant_owner','${OTHER}',true);
      INSERT INTO _onb_probe(name,value) VALUES ('sneak_other_user','LEAK');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO _onb_probe(name,value) VALUES ('sneak_other_user','raised:'||SQLSTATE);
    END $$;

    INSERT INTO _onb_probe(name,value) SELECT 'visible_merchants', count(*)::text FROM merchants;
    RESET ROLE;
  `);
  r = await readProbe();
  check("cannot insert a merchant under another id", r.sneak_other_merchant, "raised:42501");
  check("cannot insert a profile row for another tenant", r.sneak_other_user, "raised:42501");
  check("only its own merchant is visible", r.visible_merchants, "1");

  console.log("\n──── PHASE 3: cleanup ────");
  await runSql(`
    SET ROLE taployal_app;
    SET app.merchant_id = '${NEW}';
    DELETE FROM users WHERE merchant_id = '${NEW}';
    DELETE FROM merchants WHERE id = '${NEW}';
    RESET ROLE;
    INSERT INTO _onb_probe(name,value) SELECT 'cleaned', count(*)::text FROM merchants WHERE id = '${NEW}';
  `);
  r = await readProbe();
  check("fixture removed", r.cleaned, "0");

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
