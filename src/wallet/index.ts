/**
 * Wallet provider abstraction — ADR-005 ("separate platform logic from the
 * wallet provider").
 *
 * WHY THIS INTERFACE EXISTS: issuing to Apple Wallet needs a Pass Type ID
 * certificate and signing, and Google Wallet needs an approved Issuer account.
 * Those are business credentials, not code, and they change hands. Everything
 * above this file talks only to `WalletProvider`, so swapping between the hosted
 * provider and our own certificates is a driver change, never a rewrite.
 *
 * ACTIVE DRIVER: WalletWallet (https://walletwallet.dev). It signs the .pkpass
 * for us and returns a Google save link from one call. Configured through
 * WALLETWALLET_API_KEY, which must never appear in code, logs or the client.
 */

export interface WalletField {
  label?: string;
  value: string;
  /** Lock-screen banner template fired when this field's value changes. */
  changeMessage?: string;
}

export interface WalletLocation {
  latitude: number;
  longitude: number;
  relevantText?: string;
}

export interface WalletIssueInput {
  /** Data encoded in the barcode. Our pass serial — never personal data. */
  barcodeValue: string;
  barcodeFormat: "QR" | "PDF417" | "Aztec" | "Code128";
  /** Small text beside the logo (the programme name). */
  logoText: string;
  /** Issuer name: the lock-screen title on pass updates. */
  organizationName: string;
  description?: string;
  primaryFields?: WalletField[];
  secondaryFields?: WalletField[];
  backFields?: WalletField[];
  notification?: string;
  locations?: WalletLocation[];
}

export interface WalletArtifacts {
  /** The provider's identifier for the pass (not our serial). */
  serialNumber: string;
  /** Base64 of the signed .pkpass. */
  applePassBase64: string;
  /** "Save to Google Wallet" link. */
  googleSaveUrl: string;
  /** Hosted install page offering both wallets. */
  shareUrl: string | null;
}

export type WalletErrorKind =
  | "not_configured"
  | "invalid_request"
  | "unauthorized"
  | "quota_exceeded"
  | "rate_limited"
  | "upstream"
  | "bad_response";

export class WalletProviderError extends Error {
  constructor(
    message: string,
    readonly kind: WalletErrorKind,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "WalletProviderError";
  }
}

export interface WalletProvider {
  readonly driver: string;
  readonly configured: boolean;
  issue(input: WalletIssueInput): Promise<WalletArtifacts>;
}

const ENDPOINT = "https://api.walletwallet.dev/api/passes";
const TIMEOUT_MS = 20_000;

/** WalletWallet keys are `ww_live_` + 32 hex characters (per their docs). */
function readKey(): string | null {
  const key = process.env.WALLETWALLET_API_KEY;
  if (typeof key !== "string") return null;
  const trimmed = key.trim();
  if (!trimmed) return null;
  return trimmed;
}

/** One retry on a transient failure; never on a 4xx (4xx means we are wrong). */
async function postOnce(body: unknown, key: string): Promise<Response> {
  return fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

export const walletWalletProvider: WalletProvider = {
  driver: "walletwallet",
  get configured() {
    return readKey() !== null;
  },

  async issue(input: WalletIssueInput): Promise<WalletArtifacts> {
    const key = readKey();
    if (!key) {
      throw new WalletProviderError(
        "WALLETWALLET_API_KEY is not set on this deployment",
        "not_configured",
      );
    }

    let response: Response | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await postOnce(input, key);
        if (response.status >= 500 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        break;
      } catch (error) {
        lastError = error;
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
      }
    }

    if (!response) {
      throw new WalletProviderError(
        `wallet provider unreachable: ${(lastError as Error)?.message ?? "network error"}`,
        "upstream",
        true,
      );
    }

    // Map the provider's documented failures onto distinct, actionable kinds.
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      const snippet = detail.slice(0, 200);
      if (response.status === 401) {
        throw new WalletProviderError("wallet provider rejected the API key", "unauthorized");
      }
      if (response.status === 400) {
        throw new WalletProviderError(`wallet provider rejected the payload: ${snippet}`, "invalid_request");
      }
      if (response.status === 429) {
        throw new WalletProviderError("wallet provider monthly quota exceeded", "quota_exceeded");
      }
      throw new WalletProviderError(
        `wallet provider error ${response.status}: ${snippet}`,
        response.status >= 500 ? "upstream" : "bad_response",
        response.status >= 500,
      );
    }

    const body = (await response.json().catch(() => null)) as
      | { serialNumber?: unknown; applePass?: unknown; googleSaveUrl?: unknown; shareUrl?: unknown }
      | null;

    // The shape is a contract: never hand a half-built pass to the UI.
    if (
      !body ||
      typeof body.serialNumber !== "string" ||
      typeof body.applePass !== "string" ||
      typeof body.googleSaveUrl !== "string"
    ) {
      throw new WalletProviderError(
        "wallet provider returned an unexpected shape",
        "bad_response",
        true,
      );
    }

    return {
      serialNumber: body.serialNumber,
      applePassBase64: body.applePass,
      googleSaveUrl: body.googleSaveUrl,
      shareUrl: typeof body.shareUrl === "string" ? body.shareUrl : null,
    };
  },
};

let active: WalletProvider | null = null;

/** Today the hosted provider is the only driver; swapping adds a case here. */
export function getWalletProvider(): WalletProvider {
  if (!active) active = walletWalletProvider;
  return active;
}

/** Human-readable reason for the UI, without leaking provider internals. */
export function walletErrorMessage(kind: WalletErrorKind): string {
  switch (kind) {
    case "not_configured":
      return "إصدار بطاقة المحفظة غير مُهيَّأ على هذا النشر بعد.";
    case "quota_exceeded":
      return "تم استهلاك حصة إصدار البطاقات لهذا الشهر. أعد المحاولة لاحقًا.";
    case "rate_limited":
      return "عدد كبير من الطلبات الآن. أعد المحاولة بعد قليل.";
    case "unauthorized":
      return "بيانات اعتماد مزوّد المحفظة غير صحيحة.";
    case "invalid_request":
      return "تعذّر تجهيز بيانات البطاقة للمحفظة.";
    default:
      return "تعذّر الوصول إلى مزوّد المحفظة حاليًا. بطاقتك تعمل عبر المتصفح في هذه الأثناء.";
  }
}
