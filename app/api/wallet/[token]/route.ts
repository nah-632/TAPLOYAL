import { NextResponse } from "next/server";

import {
  ensureWalletArtifacts,
  getWalletStatus,
  walletFailure,
  type WalletState,
} from "@/modules/wallet-issuance";

/**
 * Wallet state for one pass.
 *
 * GET  — read-only status. Safe for a prefetch, a crawler or a health check:
 *        it performs no provider call and spends no quota.
 * POST — issue if needed, then return the state. Idempotent: an already issued
 *        pass is served from the database without touching the provider.
 *
 * AUTHORISATION: the unguessable card token IS the credential, exactly as on the
 * card page. The route never accepts pass data from the caller, so a stranger
 * cannot mint passes and burn the provider's monthly quota. Responses are
 * no-store so a shared cache can never serve one card's links for another.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;

type Context = { params: Promise<{ token: string }> };

function invalidToken() {
  return NextResponse.json({ error: "رابط البطاقة غير صالح." }, { status: 404, headers: NO_STORE });
}

function ok(state: WalletState) {
  return NextResponse.json(state, { status: 200, headers: NO_STORE });
}

export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;
  try {
    const state = await getWalletStatus(decodeURIComponent(token));
    return state ? ok(state) : invalidToken();
  } catch (error) {
    const { status, body } = walletFailure(error);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}

export async function POST(_request: Request, { params }: Context) {
  const { token } = await params;
  try {
    return ok(await ensureWalletArtifacts(decodeURIComponent(token)));
  } catch (error) {
    const { status, body } = walletFailure(error);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
