#!/usr/bin/env node
/**
 * tools/check-logical-css.mjs  (SPEC §10.5 / §11 — RTL acceptance criterion)
 *
 * "RTL first: use logical CSS properties (margin-inline, padding-inline) instead
 *  of left/right."
 *
 * Fails on physical direction utilities/properties, which do not mirror in RTL.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib", "src"];
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);

// Physical-direction Tailwind utilities and CSS declarations that break RTL.
const PATTERNS = [
  { re: /\b(?:m|p)[trblxy]?-(?:left|right)\b/, kind: "tailwind-spacing" },
  { re: /\b(?:left|right)-(?:\d|px|auto|full)\b/, kind: "tailwind-inset" },
  { re: /\b(?:border|rounded)-(?:l|r)(?:-|\b)/, kind: "tailwind-border" },
  { re: /\btext-(?:left|right)\b/, kind: "tailwind-text-align" },
  { re: /\b(?:margin|padding|border|inset)-(?:left|right)\s*:/, kind: "css-property" },
  { re: /(?:^|[\s;{])(?:left|right)\s*:\s*[^;]+;/, kind: "css-offset" },
  { re: /text-align\s*:\s*(?:left|right)\b/, kind: "css-text-align" },
];

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
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        const code = line.split("//")[0];
        for (const { re, kind } of PATTERNS) {
          if (re.test(code)) {
            violations.push({ rel, line: i + 1, kind, value: line.trim() });
          }
        }
      });
  }
}

if (violations.length) {
  console.error(`✗ check-logical-css: ${violations.length} physical-direction violation(s)\n`);
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}  [${v.kind}] ${v.value}`);
  }
  process.exit(1);
}

console.log("✓ check-logical-css: no physical left/right direction utilities");
