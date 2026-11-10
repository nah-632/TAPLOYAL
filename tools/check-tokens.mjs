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
const ALLOWLIST = new Set([
  "app/globals.css", // the CSS token source
  "lib/brand.ts",
  "src/palette/index.ts", // the JS mirror + merchant card presets (see its header)
]);
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

/* ---------------------------------------------------------------------------
 * GUARD GAP closed (2026-11-10): `bg-cream` shipped after the `--color-cream`
 * token was removed. Tailwind simply does not generate a utility for an unknown
 * token, so the element renders with NO background and nothing fails - the same
 * silent-failure class as a dangling var(). This checks every colour utility
 * against the tokens defined above plus Tailwind's own default palette.
 * ------------------------------------------------------------------------- */
const colorTokens = new Set(
  [...css.matchAll(/^\s*--color-([a-z0-9-]+)\s*:/gm)].map((m) => m[1]),
);
const textSizes = new Set([...css.matchAll(/^\s*--text-([a-z0-9-]+)\s*:/gm)].map((m) => m[1]));

/** Tailwind's built-in palette is still available; list the family names. */
const DEFAULT_FAMILIES = new Set([
  "inherit", "current", "transparent", "black", "white",
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
]);

/** Non-colour suffixes that share a colour utility prefix. */
const KEYWORDS = new Set([
  "left", "center", "right", "justify", "start", "end", "wrap", "nowrap", "balance", "pretty",
  "clip", "ellipsis", "top", "bottom", "middle", "baseline", "xs", "sm", "base", "lg", "xl",
  "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl", "none", "auto", "dashed", "dotted",
  "double", "solid", "hidden", "collapse", "separate", "cover", "contain", "fixed", "local",
  "scroll", "opacity", "blend", "clip-text", "current", "1", "2", "4", "8", "0", "full",
  "px", "flow", "repeat", "no", "origin", "gradient", "offset",
]);

const UTIL_RE = /\b(?:bg|text|border|ring|fill|stroke|from|via|to|decoration|outline|accent|caret|divide|shadow)-([a-z][a-z0-9-]*)/g;
const unknownUtilities = [];

/**
 * FALSE POSITIVE FIXED (2026-11-10): a component file named `add-to-wallet` made
 * every import of it look like the gradient utility `to-wallet`, and the guard
 * reported a colour violation on an import line. A module specifier can never be
 * a class name, so the specifier is stripped before scanning. The check itself is
 * unchanged: anything inside a className string is still scanned in full.
 */
function stripModuleSpecifiers(line) {
  return line
    .replace(/\bfrom\s*["'][^"']*["']/g, "from")
    .replace(/\bimport\s*["'][^"']*["']/g, "import")
    .replace(/\brequire\(\s*["'][^"']*["']\s*\)/g, "require()");
}

for (const dir of SCAN_DIRS) {
  for (const file of walk(path.join(ROOT, dir))) {
    const rel = path.relative(ROOT, file);
    // globals.css is raw CSS: `text-size-adjust` etc. are properties, not
    // Tailwind utilities. Only class strings in components are scanned here.
    if (rel === "app/globals.css" || rel.endsWith(".css")) continue;
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        const code = stripModuleSpecifiers(line.split("//")[0]);
        for (const m of code.matchAll(UTIL_RE)) {
          const raw = m[1];
          const base = raw.replace(/-\d{2,3}$/, ""); // bg-red-500 -> red
          if (
            colorTokens.has(raw) ||
            colorTokens.has(base) ||
            textSizes.has(raw) ||
            DEFAULT_FAMILIES.has(base) ||
            KEYWORDS.has(raw)
          ) {
            continue;
          }
          unknownUtilities.push({ rel, line: i + 1, value: m[0] });
        }
      });
  }
}

if (unknownUtilities.length) {
  console.error(
    `✗ check-tokens: ${unknownUtilities.length} colour utility(ies) reference a name that is not a token or a Tailwind colour\n`,
  );
  for (const u of unknownUtilities) {
    console.error(`  ${u.rel}:${u.line}  uses "${u.value}" — Tailwind will silently emit nothing`);
  }
  process.exit(1);
}

console.log(
  `✓ check-tokens: no hard-coded colours or font families outside app/globals.css ` +
    `(${defined.size} colour tokens defined, 0 dangling references, all colour utilities resolve)`,
);
