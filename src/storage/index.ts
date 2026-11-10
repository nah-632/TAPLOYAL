/**
 * StorageService — BUILD-PROMPT §6 ("تخزين الشعارات والملفات العامة والخاصة")
 * and directive §6 (object storage via a backend service, never the container
 * filesystem).
 *
 * CURRENT STATE, STATED PLAINLY:
 *   The CranL plan reports `buckets: 0` and `features.storage = false`, so there
 *   is no object store to write to. Rather than block the merchant journey, the
 *   active driver stores a RESIZED logo inline as a data URL on the owning row.
 *
 *   That is a real, working driver — not a stub — but it is a temporary one, and
 *   it is deliberately small: the client downsizes to <=512px and the server
 *   rejects anything above MAX_INLINE_BYTES. When a bucket exists, add an
 *   S3-compatible driver behind this same interface and switch via
 *   STORAGE_DRIVER. No caller changes.
 *
 * WHAT THIS IS NOT:
 *   It is not "container filesystem storage" (forbidden, and would be lost on
 *   redeploy), and it is not claimed to be production file storage. Large or
 *   private documents must not use it.
 */

export const MAX_INLINE_BYTES = 96 * 1024; // 96 KB
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export interface StoredAsset {
  /** Value to persist (data URL today; an object key when a bucket exists). */
  ref: string;
  bytes: number;
  contentType: string;
}

export class StorageError extends Error {}

export interface StorageService {
  readonly driver: string;
  /** Stores a public asset (e.g. a merchant logo) and returns its reference. */
  putPublicAsset(input: { dataUrl: string; ownerId: string; kind: string }): Promise<StoredAsset>;
}

const DATA_URL_RE = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i;

/**
 * Validates a data URL submitted by a browser. The client resizes, but the
 * server must not trust that — this is the control.
 */
export function parseDataUrl(dataUrl: string): { contentType: string; bytes: number; base64: string } {
  const match = DATA_URL_RE.exec(dataUrl.trim());
  if (!match) throw new StorageError("unsupported image payload");

  const contentType = match[1]!.toLowerCase();
  const base64 = match[2]!;
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
    throw new StorageError(`unsupported image type: ${contentType}`);
  }

  // base64 length -> decoded byte length (ignoring padding)
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const bytes = Math.floor((base64.length * 3) / 4) - padding;
  if (bytes > MAX_INLINE_BYTES) {
    throw new StorageError(`image is too large: ${bytes} bytes (max ${MAX_INLINE_BYTES})`);
  }
  return { contentType, bytes, base64 };
}

/** Active today. Keep the payload small; see the file header. */
export const inlineDataUrlDriver: StorageService = {
  driver: "inline-data-url",
  async putPublicAsset({ dataUrl }) {
    const { contentType, bytes } = parseDataUrl(dataUrl);
    return { ref: dataUrl, bytes, contentType };
  },
};

export function getStorage(): StorageService {
  const driver = process.env.STORAGE_DRIVER ?? "inline-data-url";
  if (driver === "inline-data-url") return inlineDataUrlDriver;
  // When a bucket is provisioned, construct the S3-compatible driver here.
  throw new StorageError(
    `storage driver "${driver}" is not implemented yet (no bucket on the current plan)`,
  );
}
