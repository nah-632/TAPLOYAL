#!/usr/bin/env node
/**
 * test/security/wallet-artifacts.test.mjs
 *
 * Question this answers: the card visitor is unauthenticated and has NO tenant
 * context, so every read under RLS returns zero rows. The wallet routes depend on
 * three token-scoped functions to work anyway. Does that door open exactly one
 * pass — and only while its merchant is active?
 *
 * Proof, as taployal_app with the merchant context RESET (i.e. exactly the
 * visitor's situation):
 *   1. the seeded pass is reachable by its token, and reports the merchant's colour,
 *   2. the signed .pkpass is NULL until artifacts are stored, then readable,
 *   3. storing artifacts flips has_apple/google_url on the same pass,
 *   4. a wrong token, a short token, and a suspended merchant all return nothing,
 *   5. cleanup.
 *
 * WHY THIS EXISTS (real defect caught before release): migration 0007 was
 * reported as applied and was not — the wallet columns and all three functions
 * were absent from the live database. The rest of the suite passed because none
 * of it touched the wallet tables. A migration that is believed to be applied is
 * not the same as a migration that works.
 */
const API = "https://app.cranl.com/api/v1";
const DB = process.env.CRANL_TAPLOYAL_DB_ID ?? "864dd005-bcd2-4662-a2bf-1603beea1811";
const KEY = process.env.CRANL_ACCESS_KEY;

const M = crypto.randomUUID();
const TOKEN = `wtest-${crypto.randomUUID()}-${crypto.randomUUID()}`; // > 20 chars
const WRONG = `wrong-${crypto.randomUUID()}-${crypto.randomUUID()}`;
const SUSPENDED = crypto.randomUUID();

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

async function probe() {
  const out = await runSql("SELECT name, value FROM _wallet_probe ORDER BY id", false);
  return Object.fromEntries(out.rows.map((r) => [r.name, r.value]));
}

const results = [];
function check(name, actual, expected) {
  const ok = String(actual) === String(expected);
  results.push({ name, actual, expected, ok });
  console.log(`  ${ok ? "✓" : "✗"} ${name} = ${actual} (expected ${expected})`);
}

const SETUP = `
  CREATE TABLE IF NOT EXISTS _wallet_probe(id serial primary key, name text, value text);
  GRANT INSERT, SELECT, TRUNCATE ON _wallet_probe TO taployal_app;
  GRANT USAGE, SELECT ON SEQUENCE _wallet_probe_id_seq TO taployal_app;
`;

const SEED = `
  TRUNCATE _wallet_probe;
  RESET ROLE;
  SET ROLE taployal_app;

  -- PHASE A: the merchant's own staff creates the program (normal RLS path).
  SET app.merchant_id = '${M}';
  INSERT INTO merchants(id,name,slug,status,primary_color)
    VALUES ('${M}','Wallet Test','wtest-${M.slice(0, 8)}','active','#15803d');
  INSERT INTO loyalty_cards(id,merchant_id,name,mode,stamps_required)
    VALUES ('${M}','${M}','Wallet Test Card','stamps',8);
  INSERT INTO customers(id,merchant_id,full_name,phone,consent_at)
    VALUES ('${M}','${M}','Sara Ahmed','+97330000000', now());
  INSERT INTO passes(id,merchant_id,card_id,customer_id,serial_number,auth_token_hash,web_view_token_hash,balance)
    VALUES ('${M}','${M}','${M}','${M}','WTTEST01','x', encode(digest('${TOKEN}','sha256'),'hex'), 3);

  -- PHASE B: the VISITOR. No tenant context at all — this is the whole point.
  RESET ROLE;
  SET ROLE taployal_app;
  SELECT set_config('app.merchant_id', '', false);

  INSERT INTO _wallet_probe(name,value)
    SELECT 'visible_passes_as_visitor', count(*)::text FROM passes;
  INSERT INTO _wallet_probe(name,value)
    SELECT 'wallet_rows', count(*)::text FROM app_pass_wallet('${TOKEN}');
  INSERT INTO _wallet_probe(name,value)
    SELECT 'wallet_serial', out_serial FROM app_pass_wallet('${TOKEN}');
  INSERT INTO _wallet_probe(name,value)
    SELECT 'wallet_first_name', out_first_name FROM app_pass_wallet('${TOKEN}');
  INSERT INTO _wallet_probe(name,value)
    SELECT 'wallet_color', out_primary_color FROM app_pass_wallet('${TOKEN}');
  INSERT INTO _wallet_probe(name,value)
    SELECT 'has_apple_before', out_has_apple::text FROM app_pass_wallet('${TOKEN}');
  INSERT INTO _wallet_probe(name,value)
    SELECT 'apple_before', coalesce(app_apple_pass_by_token('${TOKEN}'),'NULL');

  -- wrong token, short token
  INSERT INTO _wallet_probe(name,value)
    SELECT 'wrong_token_rows', count(*)::text FROM app_pass_wallet('${WRONG}');
  INSERT INTO _wallet_probe(name,value)
    SELECT 'wrong_token_apple', coalesce(app_apple_pass_by_token('${WRONG}'),'NULL');
  INSERT INTO _wallet_probe(name,value)
    SELECT 'short_token_apple', coalesce(app_apple_pass_by_token('short'),'NULL');

  -- storing artifacts (what the provider response does)
  INSERT INTO _wallet_probe(name,value)
    SELECT 'store_ok', app_store_wallet_artifacts(
      '${TOKEN}','test-driver','provider-serial-1','FAKE-PKPASS-BASE64',
      'https://pay.google.com/gp/v/save/test.jwt','https://example.test/p/1')::text;

  INSERT INTO _wallet_probe(name,value)
    SELECT 'apple_after', coalesce(app_apple_pass_by_token('${TOKEN}'),'NULL');
  INSERT INTO _wallet_probe(name,value)
    SELECT 'has_apple_after', out_has_apple::text FROM app_pass_wallet('${TOKEN}');
  INSERT INTO _wallet_probe(name,value)
    SELECT 'google_after', coalesce(out_google_url,'NULL') FROM app_pass_wallet('${TOKEN}');
  INSERT INTO _wallet_probe(name,value)
    SELECT 'provider_after', coalesce(out_provider,'NULL') FROM app_pass_wallet('${TOKEN}');
  INSERT INTO _wallet_probe(name,value)
    SELECT 'error_cleared', coalesce(out_error,'NULL') FROM app_pass_wallet('${TOKEN}');

  -- error recording
  INSERT INTO _wallet_probe(name,value)
    SELECT 'record_error', app_record_wallet_error('${TOKEN}','upstream: boom')::text;
  INSERT INTO _wallet_probe(name,value)
    SELECT 'error_after', coalesce(out_error,'NULL') FROM app_pass_wallet('${TOKEN}');

  RESET ROLE;
`;

async function main() {
  console.log(`\nfixture merchant id: ${M}`);

  await runSql(SETUP);
  console.log("\n──── PHASE 1 + 2: seed as the merchant, read as a visitor with no context ────");
  await runSql(SEED);
  let r = await probe();

  check("passes visible to a visitor with no context", r.visible_passes_as_visitor, "0");
  check("app_pass_wallet returns exactly one row", r.wallet_rows, "1");
  check("...with the pass serial", r.wallet_serial, "WTTEST01");
  check("...and only the FIRST name", r.wallet_first_name, "Sara");
  check("...and the merchant's colour", r.wallet_color, "#15803d");
  check("not issued before artifacts exist", r.has_apple_before, "false");
  check("no .pkpass before artifacts exist", r.apple_before, "NULL");

  console.log("\n──── PHASE 3: negatives ────");
  check("a wrong token unlocks nothing", r.wrong_token_rows, "0");
  check("a wrong token yields no .pkpass", r.wrong_token_apple, "NULL");
  check("a token under 20 chars is refused outright", r.short_token_apple, "NULL");

  console.log("\n──── PHASE 4: artifacts ────");
  check("storing artifacts succeeds", r.store_ok, "true");
  check("the .pkpass is readable afterwards", r.apple_after, "FAKE-PKPASS-BASE64");
  check("has_apple flips true", r.has_apple_after, "true");
  check("the Google save URL is stored", r.google_after, "https://pay.google.com/gp/v/save/test.jwt");
  check("the provider is recorded", r.provider_after, "test-driver");
  check("no stale error after success", r.error_cleared, "NULL");
  check("recording a provider error succeeds", r.record_error, "true");
  check("the error is stored on the pass", r.error_after, "upstream: boom");

  console.log("\n──── PHASE 5: a suspended merchant is not reachable ────");
  await runSql(`
    TRUNCATE _wallet_probe;
    RESET ROLE;
    SET ROLE taployal_app;
    SELECT set_config('app.merchant_id', '${M}', false);
    UPDATE merchants SET status = 'suspended' WHERE id = '${M}';
    SELECT set_config('app.merchant_id', '', false);
    INSERT INTO _wallet_probe(name,value)
      SELECT 'suspended_apple', coalesce(app_apple_pass_by_token('${TOKEN}'),'NULL');
    INSERT INTO _wallet_probe(name,value)
      SELECT 'suspended_wallet_rows', count(*)::text FROM app_pass_wallet('${TOKEN}');
    RESET ROLE;
  `);
  r = await probe();
  check("no .pkpass for a suspended merchant", r.suspended_apple, "NULL");
  check("no wallet state for a suspended merchant", r.suspended_wallet_rows, "0");

  console.log("\n──── PHASE 6: cleanup ────");
  await runSql(`
    RESET ROLE;
    SET ROLE taployal_app;
    SELECT set_config('app.merchant_id', '${M}', false);
    DELETE FROM passes WHERE merchant_id = '${M}';
    DELETE FROM customers WHERE merchant_id = '${M}';
    DELETE FROM loyalty_cards WHERE merchant_id = '${M}';
    DELETE FROM merchants WHERE id = '${M}';
    SELECT set_config('app.merchant_id', '', false);
    RESET ROLE;
    INSERT INTO _wallet_probe(name,value)
      SELECT 'leftover', count(*)::text FROM merchants WHERE id = '${M}';
  `);
  r = await probe();
  check("fixture removed", r.leftover, "0");

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
