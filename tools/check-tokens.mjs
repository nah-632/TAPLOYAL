#!/usr/bin/env node
/**
 * tools/check-tokens.mjs  (SPEC §11 — brand system acceptance criterion)
 *
 * "All platform colors and fonts come from the tokens in Section 10; no other
 *  hex value or font family appears in platform UI code."
 *
 * Fails if a hard-coded colour or font-family appears outside the single token
 * source (app/globals.css) and the sanctioned brand module.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ALLOWLIST = new Set(["app/globals.css", "lib/brand.ts"]);
const SCAN_DIRS = ["app", "components", "lib", "src"];
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".mjs"]);

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const FONT_FAMILY = /\bfont-family\s*:/;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    const full = path.join(dir, e);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (EXT.has(path.extname(full))) yield full;
  }
}

const violations = [];

for (const dir of SCAN_DIRS) {
  for (const file of walk(path.join(ROOT, dir))) {
    const rel = path.relative(ROOT, file);
    if (ALLOWLIST.has(rel)) continue;
    const src = readFileSync(file, "utf8");
    src.split("\n").forEach((line, i) => {
      // Allow SVG path data and comments that merely reference a hex token.
      for (const m of line.matchAll(HEX)) {
        violations.push({ rel, line: i + 1, kind: "hex", value: m[0] });
      }
      if (FONT_FAMILY.test(line)) {
        violations.push({ rel, line: i + 1, kind: "font-family", value: line.trim() });
      }
    });
  }
}

if (violations.length) {
  console.error(`✗ check-tokens: ${violations.length} violation(s)\n`);
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}  [${v.kind}] ${v.value}`);
  }
  process.exit(1);
}

/* ---------------------------------------------------------------------------
 * Guard for a defect this file did NOT catch (2026-11-09): after the palette
 * was replaced, globals.css still referenced `var(--color-cream)` for the page
 * background. A removed custom property fails SILENTLY in CSS — the declaration
 * is simply dropped — so the body background broke with every check green.
 * Every var(--color-*) used inside the token file must be defined in it.
 * ------------------------------------------------------------------------- */
const cssPath = path.join(ROOT, "app/globals.css");
const css = readFileSync(cssPath, "utf8");
const defined = new Set([...css.matchAll(/^\s*(--color-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
const dangling = [];
css.split("\n").forEach((line, i) => {
  if (/^\s*--color-/.test(line)) return; // a definition, not a use
  for (const m of line.matchAll(/var\((--color-[a-z0-9-]+)(?=[,)]|$)/g)) {
    if (!defined.has(m[1])) dangling.push({ line: i + 1, name: m[1] });
  }
});

if (dangling.length) {
  console.error(`✗ check-tokens: ${dangling.length} reference(s) to undefined colour tokens\n`);
  for (const d of dangling) {
    console.error(`  app/globals.css:${d.line}  uses ${d.name}, which is not defined`);
  }
  console.error("\n  CSS drops an unknown custom property silently - the rule just stops working.");
  process.exit(1);
}

console.log(
  `✓ check-tokens: no hard-coded colours or font families outside app/globals.css ` +
    `(${defined.size} colour tokens defined, 0 dangling references)`,
);
