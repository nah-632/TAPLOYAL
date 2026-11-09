#!/usr/bin/env node
/**
 * tools/patch-next-for-sandbox.mjs
 *
 * WHY THIS EXISTS (see docs/adr/DECISIONS.md → ADR-009):
 * This sandbox (iSH/Alpine, Node 22) prepends a fixed set of V8 flags to EVERY
 * `node` invocation, so they always appear in `process.execArgv`. Those flags are
 * legitimate as direct CLI arguments, but several of them are NOT allowed inside
 * `NODE_OPTIONS` by Node 22.
 *
 * Next.js builds the child dev-server environment with
 *   getParsedNodeOptions() = [...process.execArgv, ...NODE_OPTIONS]
 * and forwards everything that is not in EXEC_ARGV_ONLY_OPTIONS into NODE_OPTIONS.
 * The forked child then dies with:
 *   node: --single-generation is not allowed in NODE_OPTIONS
 *
 * FIX: register the sandbox flags in EXEC_ARGV_ONLY_OPTIONS so Next.js passes them
 * to the forked child as real CLI arguments (execArgv) instead of via NODE_OPTIONS
 * — exactly what the parent process already does.
 *
 * Idempotent, self-detecting, non-destructive. If the flags are absent (a normal
 * machine) it does nothing. It only ever writes inside node_modules.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

/** Flags this sandbox injects; none of them are allowed inside NODE_OPTIONS. */
const SANDBOX_FLAGS = [
  "single-generation",
  "no-lazy-compile-dispatcher",
  "no-concurrent-recompilation",
  "no-concurrent-marking",
  "regexp-interpret-all",
  "no-opt",
  "no-maglev",
  "no-sparkplug",
];

const MARKER = "sandbox-flag";

function injectedFlags() {
  return SANDBOX_FLAGS.filter((f) =>
    process.execArgv.some((a) => a === `--${f}`),
  );
}

function patchFile(file) {
  if (!existsSync(file)) return "missing";
  const src = readFileSync(file, "utf8");
  if (src.includes(MARKER)) return "already-patched";

  const re = /const EXEC_ARGV_ONLY_OPTIONS = new Set\(\[([\s\S]*?)\]\);/;
  const m = src.match(re);
  if (!m) return "pattern-not-found";

  const existing = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  const missing = injectedFlags().filter((f) => !existing.includes(f));
  if (missing.length === 0) return "nothing-to-add";

  const body = [
    ...existing.map((e) => `    '${e}',`),
    ...missing.map((f) => `    '${f}', // ${MARKER}`),
  ].join("\n");

  writeFileSync(
    file,
    src.replace(re, `const EXEC_ARGV_ONLY_OPTIONS = new Set([\n${body}\n]);`),
  );
  return `patched (+${missing.length})`;
}

const nextDir = path.dirname(require.resolve("next/package.json"));
const targets = [
  path.join(nextDir, "dist/server/lib/utils.js"),
  path.join(nextDir, "dist/esm/server/lib/utils.js"),
];

const injected = injectedFlags();
if (injected.length === 0) {
  console.log("[patch-next-for-sandbox] sandbox flags absent — nothing to do.");
  process.exit(0);
}

console.log(`[patch-next-for-sandbox] detected: ${injected.join(", ")}`);
for (const t of targets) {
  console.log(`  ${path.relative(process.cwd(), t)} → ${patchFile(t)}`);
}
