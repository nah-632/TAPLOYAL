import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/* ============================================================================
 * SPEC §10.2 — fonts.
 *
 * Deliberately SELF-HOSTED (next/font/local) instead of next/font/google:
 *   1. this sandbox cannot reach fonts.gstatic.com (IPv6 unreachable), and
 *   2. SPEC §10.7 requires the join page under 100KB / <2s on 4G, which rules
 *      out a third-party font request on the critical path.
 * The families are exactly the four required by §10.2, subset to the glyphs we
 * use (latin + arabic). See docs/adr/DECISIONS.md → ADR-010.
 * ========================================================================== */

const playfair = localFont({
  src: [
    { path: "../public/fonts/playfair-display-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/playfair-display-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/playfair-display-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-playfair",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const inter = localFont({
  src: [
    { path: "../public/fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "Arial", "sans-serif"],
});

const plexArabic = localFont({
  src: [
    { path: "../public/fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/ibm-plex-sans-arabic-arabic-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-plex-arabic",
  display: "swap",
  fallback: ["Tahoma", "Arial", "sans-serif"],
});

const notoNaskh = localFont({
  src: [
    { path: "../public/fonts/noto-naskh-arabic-arabic-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/noto-naskh-arabic-arabic-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/noto-naskh-arabic-arabic-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-noto-naskh",
  display: "swap",
  fallback: ["Times New Roman", "serif"],
});

export const metadata: Metadata = {
  title: "taployal — TAP. COLLECT. REDEEM.",
  description:
    "منصة ولاء رقمية: أنشئ بطاقة ولاء بهويتك وأصدرها لعملائك في Apple Wallet وGoogle Wallet بلمسة واحدة.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${playfair.variable} ${inter.variable} ${plexArabic.variable} ${notoNaskh.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
