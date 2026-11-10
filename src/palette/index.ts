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

/* ---------------------------------------------------------------------------
 * Wallet pass colour.
 *
 * WalletWallet exposes six named presets on every plan; a custom hex `color` is
 * Pro-only. Sending a Pro-only field would make issuance start returning 400 the
 * day the subscription changes, so the merchant's hex is mapped onto the nearest
 * preset instead and the pass keeps working on the free plan forever.
 *
 * The rule is deliberately simple and hue-based, not a "nearest swatch" lookup
 * against hex values we would have to invent: we do not know the provider's exact
 * preset values, and guessing them would be a fabricated constant. Very dark
 * colours map to `dark` regardless of hue, because on a pass a near-black face
 * reads as intentional while a muddy dark blue does not.
 * ------------------------------------------------------------------------- */
export const WALLET_COLOR_PRESETS = ["dark", "blue", "green", "red", "purple", "orange"] as const;
export type WalletColorPreset = (typeof WALLET_COLOR_PRESETS)[number];

export function walletColorPreset(hex: unknown): WalletColorPreset {
  const v = normalizeHexColor(hex) ?? PLATFORM.navy;
  const r = Number.parseInt(v.slice(1, 3), 16);
  const g = Number.parseInt(v.slice(3, 5), 16);
  const b = Number.parseInt(v.slice(5, 7), 16);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2 / 255;
  if (lightness < 0.2) return "dark";

  const delta = max - min;
  if (delta === 0) return "dark"; // achromatic

  let hue: number;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  if (hue < 0) hue += 360;

  if (hue < 15 || hue >= 345) return "red";
  if (hue < 45) return "orange";
  if (hue < 170) return "green";
  if (hue < 260) return "blue";
  if (hue < 320) return "purple";
  return "red";
}
