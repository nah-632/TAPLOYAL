#!/usr/bin/env node
/**
 * tools/check-routes.mjs
 *
 * GUARD for a real production defect (2026-11-09): the landing page linked to
 * `/style` and `/ar/style`, neither of which existed, so EVERY link on the live
 * site returned 404. `tsc` and the existing checks all passed — nothing was
 * watching link targets.
 *
 * This walks app/ for internal links and image/link targets, then asserts a
 * matching route file exists:
 *   href="/style"        -> app/style/page.tsx
 *   href="/api/auth/ok"  -> app/api/auth/ok/route.ts
 *
 * External URLs, anchors, mailto:/tel: and Next internals are skipped.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP = path.join(ROOT, "app");
const EXT = new Set([".ts", ".tsx", ".js", ".jsx"]);

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (EXT.has(path.extname(full))) yield full;
  }
}

/** A route exists if a page/route file lives at the matching app path. */
function routeExists(target) {
  const clean = target.split("?")[0].split("#")[0].replace(/\/+$/, "");
  if (clean === "") return existsSync(path.join(APP, "page.tsx"));
  const segs = clean.split("/").filter(Boolean);
  const base = path.join(APP, ...segs);
  if (existsSync(path.join(base, "page.tsx"))) return true;
  if (existsSync(path.join(base, "route.ts"))) return true;
  // dynamic / catch-all segments, e.g. app/api/auth/[...all]/route.ts
  const parent = path.dirname(base);
  for (const dir of [base, parent]) {
    let entries = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.startsWith("[") && e.endsWith("]")) {
        const p = path.join(dir, e);
        if (existsSync(path.join(p, "page.tsx")) || existsSync(path.join(p, "route.ts"))) {
          return true;
        }
      }
    }
  }
  return false;
}

const violations = [];
const LINK_RE = /(?:href|as)=["'](\/[^"']*)["']/g;

for (const file of walk(APP)) {
  const rel = path.relative(ROOT, file);
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const code = line.split("//")[0];
      for (const m of code.matchAll(LINK_RE)) {
        const target = m[1];
        if (!routeExists(target)) {
          violations.push({ rel, line: i + 1, target });
        }
      }
    });
}

if (violations.length) {
  console.error(`✗ check-routes: ${violations.length} internal link(s) point at routes that do not exist\n`);
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}  ->  ${v.target}   (no matching app/**/page.tsx | route.ts)`);
  }
  console.error("\n  This is the defect that made every link 404 in production. Fix the link or add the route.");
  process.exit(1);
}

console.log("✓ check-routes: every internal link resolves to a real route");
