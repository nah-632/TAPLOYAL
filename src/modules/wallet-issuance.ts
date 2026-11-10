import { sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  getWalletProvider,
  WalletProviderError,
  walletErrorMessage,
  type WalletErrorKind,
  type WalletIssueInput,
} from "@/wallet";
import { walletColorPreset } from "@/palette";

/**
 * Wallet issuance for an existing pass.
 *
 * SECURITY DECISION (deliberate, and different from the obvious design):
 * the caller proves ownership with the pass's unguessable view token, NOT by
 * sending pass data. A public "create me a pass" endpoint would let anyone mint
 * passes and burn the provider's monthly quota. Here the only reachable pass is
 * the one the token unlocks, a pass is issued once and then served from cache,
 * and the provider's key never leaves the server.
 *
 * The result of issuing is cached ON THE PASS, so a reload, a re-install or a
 * second device costs no quota.
 */

export interface WalletState {
  configured: boolean;
  issued: boolean;
  hasApple: boolean;
  googleUrl: string | null;
  shareUrl: string | null;
  provider: string | null;
  error: string | null;
  /** Convenience for the UI: server-owned URLs, never provider URLs we cannot vouch for. */
  appleUrl: string | null;
}

export class WalletIssuanceError extends Error {
  constructor(readonly kind: WalletErrorKind, message?: string) {
    super(message ?? walletErrorMessage(kind));
    this.name = "WalletIssuanceError";
  }
}

/**
 * HTTP status per failure kind, so all three wallet routes answer the same way.
 * `not_configured` is 503 rather than 500 on purpose: nothing is broken in the
 * code, the deployment is simply missing its key, and the UI says so.
 */
export function walletHttpStatus(kind: WalletErrorKind): number {
  switch (kind) {
    case "invalid_request":
      return 404;
    case "not_configured":
      return 503;
    case "rate_limited":
    case "quota_exceeded":
      return 429;
    default:
      return 502;
  }
}

/** Uniform JSON error body. Never carries the token or provider internals. */
export function walletFailure(error: unknown): {
  status: number;
  body: { error: string; kind: WalletErrorKind; retryable: boolean };
} {
  const kind: WalletErrorKind = error instanceof WalletIssuanceError ? error.kind : "upstream";
  const retryable = kind === "upstream" || kind === "rate_limited";
  return {
    status: walletHttpStatus(kind),
    body: {
      error: error instanceof WalletIssuanceError ? error.message : walletErrorMessage(kind),
      kind,
      retryable,
    },
  };
}

/* ---------------------------------------------------------------------------
 * Rate limiting.
 *
 * Two layers, because they protect different things:
 *  1. per-pass cooldown — one issuance per pass per 60s. Idempotent reloads and
 *     double taps hit the cache anyway, so this only catches scripted abuse.
 *  2. a small global bucket — a ceiling on how much provider quota a burst of
 *     distinct passes can consume.
 *
 * In-memory on purpose: it is a per-instance guard, not an accounting system.
 * The provider's own monthly limit is the real cap, and it is surfaced to the
 * user as a distinct error rather than a generic failure.
 * ------------------------------------------------------------------------- */
const COOLDOWN_MS = 60_000;
const BUCKET_CAPACITY = 30;
const BUCKET_REFILL_MS = 4_000; // one token every 4s

const lastIssuedAt = new Map<string, number>();
let bucket = BUCKET_CAPACITY;
let bucketUpdatedAt = Date.now();

function takeToken(): boolean {
  const now = Date.now();
  const refill = Math.floor((now - bucketUpdatedAt) / BUCKET_REFILL_MS);
  if (refill > 0) {
    bucket = Math.min(BUCKET_CAPACITY, bucket + refill);
    bucketUpdatedAt = now;
  }
  if (bucket <= 0) return false;
  bucket -= 1;
  return true;
}

interface PassRow {
  out_pass_id: string;
  out_serial: string;
  out_first_name: string;
  out_balance: number;
  out_business_name: string;
  out_program_name: string;
  out_mode: string;
  out_stamps_required: number | null;
  out_primary_color: string | null;
  out_has_apple: boolean;
  out_google_url: string | null;
  out_share_url: string | null;
  out_provider: string | null;
  out_error: string | null;
}

async function readPass(token: string): Promise<PassRow | null> {
  if (!token || token.length < 20) return null;
  const rows = await getDb().execute(sql`SELECT * FROM app_pass_wallet(${token})`);
  return ((rows as unknown as PassRow[])[0] ?? null) as PassRow | null;
}

async function persist(
  token: string,
  artifacts: { serialNumber: string; applePassBase64: string; googleSaveUrl: string; shareUrl: string | null },
  driver: string,
): Promise<void> {
  await getDb().execute(sql`
    SELECT app_store_wallet_artifacts(
      ${token}, ${driver}, ${artifacts.serialNumber},
      ${artifacts.applePassBase64}, ${artifacts.googleSaveUrl}, ${artifacts.shareUrl}
    )
  `);
}

async function recordError(token: string, message: string): Promise<void> {
  try {
    await getDb().execute(sql`SELECT app_record_wallet_error(${token}, ${message})`);
  } catch {
    // Never let error bookkeeping mask the original failure.
  }
}

/**
 * Provider field limits (WalletWallet API reference). Exceeding any of these is
 * a hard 400, so every string that comes from merchant- or customer-entered data
 * is clipped here rather than trusted to be short.
 */
const CLIP = { text: 64, value: 256, description: 128, barcode: 1024 } as const;

function clip(value: string | null | undefined, max: number): string {
  const v = (value ?? "").trim();
  return v.length <= max ? v : v.slice(0, max);
}

/** Builds the provider payload from the pass and its programme. */
function buildInput(pass: PassRow): WalletIssueInput {
  const isPoints = pass.out_mode === "points";
  const unit = isPoints ? "نقطة" : "ختم";
  const remaining =
    pass.out_stamps_required == null ? null : Math.max(0, pass.out_stamps_required - pass.out_balance);

  const backFields = [
    { label: "رقم البطاقة", value: clip(pass.out_serial, CLIP.value) },
    pass.out_first_name
      ? { label: "الاسم", value: clip(pass.out_first_name, CLIP.value) }
      : null,
  ].filter((f): f is { label: string; value: string } => f !== null && f.value.length > 0);

  return {
    // The barcode carries our serial and nothing else — never personal data.
    barcodeValue: clip(pass.out_serial, CLIP.barcode),
    barcodeFormat: "QR",
    logoText: clip(pass.out_program_name || pass.out_business_name, CLIP.text),
    organizationName: clip(pass.out_business_name, CLIP.text),
    description: clip(`${pass.out_business_name} — بطاقة الولاء`, CLIP.description),
    // Free-plan-safe branding: a preset, never a custom hex or an image URL.
    colorPreset: walletColorPreset(pass.out_primary_color),
    sharingProhibited: true,
    primaryFields: [
      { label: "", value: clip(String(pass.out_balance), CLIP.value) },
      { label: isPoints ? "النقاط" : "الأختام", value: unit },
    ],
    secondaryFields:
      remaining == null
        ? []
        : [{ label: "المتبقي للمكافأة", value: clip(String(remaining), CLIP.value) }],
    backFields,
  };
}

/** The state to render, built from one read of the pass. */
function toState(pass: PassRow, token: string, configured: boolean): WalletState {
  const hasApple = pass.out_has_apple;
  const googleUrl = pass.out_google_url;
  return {
    configured,
    issued: hasApple && !!googleUrl,
    hasApple,
    googleUrl,
    shareUrl: pass.out_share_url,
    provider: pass.out_provider,
    error: pass.out_error,
    appleUrl: hasApple ? `/api/wallet/${encodeURIComponent(token)}/apple` : null,
  };
}

/**
 * Read-only status. Performs no provider call and spends no quota, so it is safe
 * to hit on every page view (including a prefetch or a crawler that never taps
 * anything). Returns null when the token does not unlock an active pass.
 */
export async function getWalletStatus(token: string): Promise<WalletState | null> {
  const pass = await readPass(token);
  if (!pass) return null;
  return toState(pass, token, getWalletProvider().configured);
}

/**
 * Ensures the pass has wallet artifacts, returning the state to render.
 * Idempotent: a second call for an issued pass performs no network request.
 */
export async function ensureWalletArtifacts(token: string): Promise<WalletState> {
  const provider = getWalletProvider();
  const pass = await readPass(token);
  if (!pass) throw new WalletIssuanceError("invalid_request", "رابط البطاقة غير صالح.");

  const cached = toState(pass, token, provider.configured);

  // Already issued: serve from cache, spend no quota.
  if (cached.issued) return cached;

  if (!provider.configured) {
    return {
      ...cached,
      error:
        "لم يُضبط مفتاح مزوّد المحفظة على هذا النشر (WALLETWALLET_API_KEY). " +
        "بطاقتك تعمل عبر المتصفح.",
    };
  }

  // Cooldown: a second issuance for the same pass within a minute is refused
  // rather than silently costing another provider call.
  const last = lastIssuedAt.get(pass.out_pass_id);
  if (last && Date.now() - last < COOLDOWN_MS) {
    throw new WalletIssuanceError("rate_limited");
  }
  if (!takeToken()) throw new WalletIssuanceError("rate_limited");

  lastIssuedAt.set(pass.out_pass_id, Date.now());

  try {
    const artifacts = await provider.issue(buildInput(pass));
    await persist(token, artifacts, provider.driver);
    return {
      configured: true,
      issued: true,
      hasApple: true,
      googleUrl: artifacts.googleSaveUrl,
      shareUrl: artifacts.shareUrl,
      provider: provider.driver,
      error: null,
      appleUrl: `/api/wallet/${encodeURIComponent(token)}/apple`,
    };
  } catch (error) {
    const kind = error instanceof WalletProviderError ? error.kind : "upstream";
    // Never persist a partially built pass; record why so it is diagnosable.
    await recordError(token, `${kind}: ${(error as Error).message}`);
    throw new WalletIssuanceError(kind);
  }
}

/**
 * The signed .pkpass, for the download route. Null when not issued yet.
 *
 * Goes through app_apple_pass_by_token() rather than selecting from `passes`:
 * the runtime role is taployal_app under FORCE RLS, and the visitor holding a
 * card link has no tenant context, so a direct query matches zero rows. Reading
 * `passes` here looked correct and would have 404'd every download in production.
 */
export async function getApplePass(token: string): Promise<string | null> {
  if (!token || token.length < 20) return null;
  const rows = await getDb().execute(sql`SELECT app_apple_pass_by_token(${token}) AS b64`);
  const row = (rows as unknown as { b64: string | null }[])[0];
  return row?.b64 ?? null;
}
