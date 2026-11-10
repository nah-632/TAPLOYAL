#!/usr/bin/env node
/**
 * test/security/cache-headers.test.mjs
 *
 * Question this answers: does the deployed site tell a shared cache that a
 * per-account or per-customer response is shareable?
 *
 * DEFECT THIS GUARDS (2026-11-10): next.config.ts applied
 * `Cache-Control: public, max-age=0, s-maxage=60` to `/:path*`, which includes
 * all of `/api/**`. Next's `headers()` output OVERRIDES whatever a route handler
 * sets, so a wallet route that explicitly asked for `private, no-store` went out
 * as `public, s-maxage=60`, and the platform's edge answered `x-ggp-cache: HIT`
 * while serving a signed .pkpass and a pass-status JSON. The suite did not notice
 * because nothing asserted response headers.
 *
 * The header is ours to control, so it is asserted. The edge's own cache verdict
 * (`x-ggp-cache`) is reported but not asserted: it is platform behaviour, and a
 * red suite for something we cannot change would be noise rather than signal.
 *
 * Usage: node test/security/cache-headers.test.mjs   (needs a live deployment)
 */
const BASE = process.env.TAPLOYAL_ORIGIN ?? "https://taployal-rvoepg.cranl.net";
const TOKEN = "a".repeat(40);

const PRIVATE = [
  "/api/auth/ok",
  `/api/wallet/${TOKEN}`,
  "/dashboard",
  "/onboarding",
  `/c/${TOKEN}`,
];

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function head(path) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: { Accept: "text/html" },
  });
  // Drain so the connection is reusable; the body is irrelevant here.
  await res.arrayBuffer().catch(() => {});
  return res;
}

function noStore(value) {
  const v = (value ?? "").toLowerCase();
  return v.includes("no-store") && v.includes("private");
}

async function main() {
  console.log(`\norigin: ${BASE}\n`);

  console.log("──── PHASE 1: private responses must not be shareable ────");
  for (const path of PRIVATE) {
    const res = await head(path);
    const cc = res.headers.get("cache-control");
    const verdict = res.headers.get("x-ggp-cache") ?? "-";
    check(
      `no-store on ${path}`,
      noStore(cc),
      `status=${res.status} cache-control="${cc}" edge=${verdict}`,
    );
  }

  console.log("\n──── PHASE 2: the rule must be scoped, not blanket ────");
  // If the whole site were no-store this suite would pass phase 1 while the
  // public pages lost the short edge cache that makes a deploy propagate.
  const home = await head("/");
  const homeCc = home.headers.get("cache-control") ?? "";
  check(
    "public page keeps its short public cache",
    homeCc.toLowerCase().includes("s-maxage=60") && !noStore(homeCc),
    `cache-control="${homeCc}"`,
  );

  // A REAL asset, discovered from the page: a made-up path 404s, and Next serves
  // its own `no-store` on a 404, which would make this check pass for the wrong
  // reason.
  const html = await (await fetch(`${BASE}/`)).text();
  const assetPath = html.match(/\/_next\/static\/[^"'\\ ]+\.(?:js|css)/)?.[0];
  check("a hashed asset is discoverable in the page", Boolean(assetPath), assetPath ?? "none found");
  if (assetPath) {
    const asset = await head(assetPath);
    const assetCc = asset.headers.get("cache-control") ?? "";
    check(
      "hashed build assets keep the immutable cache",
      assetCc.toLowerCase().includes("immutable"),
      `${assetPath} → cache-control="${assetCc}"`,
    );
  }

  console.log("\n──── PHASE 3: prove the check can fail ────");
  // A canary for the assertion itself: the same predicate must reject the header
  // that was actually served before the fix.
  check(
    "the predicate rejects the pre-fix header",
    !noStore("public, max-age=0, s-maxage=60, stale-while-revalidate=300"),
  );
  check("the predicate rejects a missing header", !noStore(undefined));

  const failed = results.filter((r) => !r.ok);
  console.log("\n════ SUMMARY ════");
  console.log(`assertions: ${results.length} · failed: ${failed.length}`);
  for (const f of failed) console.log(`  FAIL ${f.name}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error("harness error:", e.message);
  process.exit(1);
});
