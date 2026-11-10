import { sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import {
  getWalletProvider,
  WalletProviderError,
  walletErrorMessage,
  type WalletErrorKind,
  type WalletIssueInput,
} from "@/wallet";

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

/** Builds the provider payload from the pass and its programme. */
function buildInput(pass: PassRow): WalletIssueInput {
  const unit = pass.out_mode === "points" ? "نقطة" : "ختم";
  const remaining =
    pass.out_stamps_required == null ? null : Math.max(0, pass.out_stamps_required - pass.out_balance);

  return {
    // The barcode carries our serial and nothing else — never personal data.
    barcodeValue: pass.out_serial,
    barcodeFormat: "QR",
    logoText: pass.out_program_name || pass.out_business_name,
    organizationName: pass.out_business_name.slice(0, 64),
    description: `${pass.out_business_name} — بطاقة الولاء`,
    primaryFields: [
      { label: "", value: String(pass.out_balance) },
      { label: unit === "نقطة" ? "النقاط" : "الأختام", value: unit },
    ],
    secondaryFields:
      remaining == null
        ? []
        : [{ label: "المتبقي للمكافأة", value: String(remaining) }],
    backFields: [
      { label: "رقم البطاقة", value: pass.out_serial },
      { label: "الاسم", value: pass.out_first_name },
    ],
  };
}

/**
 * Ensures the pass has wallet artifacts, returning the state to render.
 * Idempotent: a second call for an issued pass performs no network request.
 */
export async function ensureWalletArtifacts(token: string): Promise<WalletState> {
  const provider = getWalletProvider();
  const pass = await readPass(token);
  if (!pass) throw new WalletIssuanceError("invalid_request", "رابط البطاقة غير صالح.");

  const appleUrl = `/api/wallet/${encodeURIComponent(token)}/apple`;

  const cached: WalletState = {
    configured: provider.configured,
    issued: pass.out_has_apple && !!pass.out_google_url,
    hasApple: pass.out_has_apple,
    googleUrl: pass.out_google_url,
    shareUrl: pass.out_share_url,
    provider: pass.out_provider,
    error: pass.out_error,
    appleUrl: pass.out_has_apple ? appleUrl : null,
  };

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
      appleUrl,
    };
  } catch (error) {
    const kind = error instanceof WalletProviderError ? error.kind : "upstream";
    // Never persist a partially built pass; record why so it is diagnosable.
    await recordError(token, `${kind}: ${(error as Error).message}`);
    throw new WalletIssuanceError(kind);
  }
}

/** The cached .pkpass, for the download route. Null when not issued yet. */
export async function getApplePass(token: string): Promise<string | null> {
  const rows = await getDb().execute(sql`
    SELECT apple_pass_b64 FROM passes
    WHERE web_view_token_hash = encode(digest(${token}, 'sha256'), 'hex')
      AND length(${token}) >= 20
  `);
  const row = (rows as unknown as { apple_pass_b64: string | null }[])[0];
  return row?.apple_pass_b64 ?? null;
}
