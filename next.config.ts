import type { NextConfig } from "next";

/**
 * Every path under these prefixes renders data belonging to ONE account or ONE
 * customer at a URL that is identical for all of them, so none of it may sit in
 * a shared cache. Declared as a list because the bare route ("/dashboard") and
 * its children ("/dashboard/x") are separate patterns, and missing the bare one
 * leaves the most common request unprotected.
 */
const PRIVATE_SOURCES = ["/api", "/dashboard", "/onboarding", "/c"];

/** `CDN-Cache-Control` is sent alongside: an edge cache in front of Next reads it in preference to `Cache-Control`. */
const NO_STORE_HEADERS = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "CDN-Cache-Control", value: "no-store" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emits .next/standalone/server.js — the runtime image installs nothing.
  output: "standalone",
  // The project lives outside the npm "workspace root" here, so Next would
  // otherwise try to trace files from the user home directory.
  outputFileTracingRoot: import.meta.dirname,
  // Security headers (SPEC §9). Tightened further in Phase 7.
  async headers() {
    return [
      // ── Caching ────────────────────────────────────────────────────────────
      // PRODUCTION DEFECT (2026-11-09): prerendered HTML was served with
      // `s-maxage=31536000`, so a fix that had been deployed kept showing the
      // OLD page at the edge for up to a year — every deploy silently failed to
      // reach users until the CDN was purged by hand.
      //
      // Content-hashed build assets keep their long, immutable cache; documents
      // get a short one so a deploy propagates on its own.
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
          },
        ],
      },
      // ── Never cache per-user or per-credential responses ───────────────────
      // DEFECT FIXED (2026-11-10): the blanket rule above matches `/:path*`,
      // which includes `/api/**`, and Next's `headers()` output OVERRIDES a
      // `Cache-Control` set inside a route handler. So every API response — auth
      // endpoints included — went out as `public, s-maxage=60`. That was not
      // theoretical: the platform's edge reported `x-ggp-cache: HIT` while
      // serving a signed .pkpass and a pass-status JSON, and a wallet route that
      // explicitly set `private, no-store` was silently rewritten to `public`.
      // A shared cache holding a customer's pass, or a session response, is a
      // cross-user leak waiting for a warm path, and the URL being unguessable is
      // not a control we should be relying on.
      //
      // The app exposes no public API, so `no-store` is the correct default for
      // the whole namespace rather than a per-route override. `CDN-Cache-Control`
      // is sent alongside because an edge cache in front of Next reads it in
      // preference to `Cache-Control`.
      ...PRIVATE_SOURCES.flatMap((base) => [
        { source: base, headers: NO_STORE_HEADERS },
        { source: `${base}/:path*`, headers: NO_STORE_HEADERS },
      ]),
      {
        // Declared last so it wins for hashed assets: the filename changes
        // whenever the content does, which is what makes a year safe here.
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
