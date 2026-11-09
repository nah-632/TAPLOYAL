import type { NextConfig } from "next";

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
