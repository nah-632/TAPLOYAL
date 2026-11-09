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
