import { NextResponse } from "next/server";

import { isAllowedGoogleSaveUrl } from "@/wallet";
import { ensureWalletArtifacts, walletFailure } from "@/modules/wallet-issuance";

/**
 * Redirects to the provider's Google save link.
 *
 * The link is a JWT that Google Wallet consumes to install the pass, and Android
 * only accepts it from that address, so a redirect is the correct shape. The
 * destination is validated against Google's own save hosts before we redirect:
 * the URL is stored data that we redirect to, which makes a bad value an open
 * redirect, and a redirect sink is worth one cheap check.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;

type Context = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;

  let googleUrl: string | null = null;
  try {
    const state = await ensureWalletArtifacts(decodeURIComponent(token));
    googleUrl = state.googleUrl;
  } catch (error) {
    const { status, body } = walletFailure(error);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }

  if (!isAllowedGoogleSaveUrl(googleUrl)) {
    return NextResponse.json(
      { error: "بطاقة Google Wallet غير متاحة لهذه البطاقة." },
      { status: 404, headers: NO_STORE },
    );
  }

  return NextResponse.redirect(googleUrl, { status: 302, headers: NO_STORE });
}
