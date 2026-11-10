/**
 * Brand palette — the JavaScript mirror of the tokens in `app/globals.css`.
 *
 * PATH NOTE: this lives in `src/palette/`, not `src/brand/` — `src/brand` is
 * un-creatable in this container (a poisoned dentry; see ADR-001 §17).
 *
 * TWO separate colour systems live in this product, and confusing them is a real
 * defect class:
 *
 *  1. PLATFORM palette — the taployal UI itself. Source of truth is
 *     `app/globals.css` (@theme). BUILD-PROMPT §11.A. Nothing may hard-code it.
 *  2. MERCHANT card presets — the wallet pass belongs to the MERCHANT, not to
 *     taployal ("اللون الأساسي/الثانوي/لون النص" in §5 card builder). These are
 *     only starting points the merchant may change freely, so they are not UI
 *     tokens and cannot live in globals.css.
 *
 * `tools/check-tokens.mjs` allowlists this file for the same reason it allows
 * `app/globals.css`: it is a token source, not a component writing literals.
 */

/** Platform palette — keep in sync with app/globals.css @theme. */
export const PLATFORM = {
  navy: "#14243a",
  midnight: "#1d3557",
  teal: "#16a6a1",
  mint: "#ddf5f0",
  warmWhite: "#fafbfc",
  slate: "#64748b",
} as const;

/** Starting points offered to a merchant in the card builder. */
export const CARD_PRESETS = [
  { id: "taployal", label: "taployal الافتراضي", primary: "#14243a", secondary: "#16a6a1", text: "#fafbfc" },
  { id: "midnight", label: "أزرق منتصف الليل", primary: "#1d3557", secondary: "#ddf5f0", text: "#fafbfc" },
  { id: "mint", label: "نعناعي فاتح", primary: "#ddf5f0", secondary: "#14243a", text: "#14243a" },
  { id: "slate", label: "رمادي هادئ", primary: "#64748b", secondary: "#fafbfc", text: "#fafbfc" },
] as const;

export const DEFAULT_CARD_COLORS = {
  primaryColor: PLATFORM.navy,
  secondaryColor: PLATFORM.teal,
  textColor: PLATFORM.warmWhite,
} as const;

/** Stamp icon library — §11 lists coffee, scissors, bag, fork/knife, star. */
export const STAMP_ICONS = [
  { key: "coffee", label: "فنجان قهوة" },
  { key: "scissors", label: "مقص" },
  { key: "bag", label: "كيس تسوق" },
  { key: "restaurant", label: "شوكة وسكين" },
  { key: "star", label: "نجمة" },
  { key: "heart", label: "قلب" },
] as const;

export type StampIconKey = (typeof STAMP_ICONS)[number]["key"];

/** Rejects anything that is not a plain #rrggbb colour before it can be stored. */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(v) ? v : null;
}
