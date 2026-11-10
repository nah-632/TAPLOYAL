import { headers } from "next/headers";

/**
 * Absolute origin for links rendered on the server.
 *
 * WHY IT EXISTS: a QR code must encode an absolute URL, and a QR built from a
 * wrong host is unusable — the customer scans it and lands nowhere. Behind the
 * platform's proxy the `Host` header is rewritten, so `APP_URL` (set on the
 * deployment) wins when it is present and the request headers are the fallback
 * for local runs.
 */
export async function serverOrigin(): Promise<string> {
  const configured = process.env.APP_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Malformed APP_URL must not break the page; fall through to the request.
    }
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  if (!host) return "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
