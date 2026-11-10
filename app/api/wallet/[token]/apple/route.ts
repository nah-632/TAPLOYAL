import { NextResponse } from "next/server";

import { ensureWalletArtifacts, getApplePass, walletFailure } from "@/modules/wallet-issuance";

/**
 * Serves the signed .pkpass from OUR origin.
 *
 * Delegating this to the provider's link would hand iOS a cross-origin download
 * and, more importantly, would let the provider's URL shape decide whether the
 * pass opens in Wallet or lands in Files. Serving it ourselves with the exact
 * MIME type Apple requires is what makes the "Add to Wallet" step reliable.
 *
 * HTTP DETAIL THAT MATTERS: no `Content-Disposition: attachment`. With the
 * pkpass MIME type and no attachment header Safari opens the pass directly;
 * marking it as a download sends the customer to the Files app instead.
 *
 * Issuance is ensured first (idempotent), so a bookmarked or re-opened link
 * works even if the customer never loaded the card page in this session.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;

type Context = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;
  const passToken = decodeURIComponent(token);

  try {
    await ensureWalletArtifacts(passToken);
  } catch (error) {
    const { status, body } = walletFailure(error);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }

  const base64 = await getApplePass(passToken);
  if (!base64) {
    return NextResponse.json(
      { error: "بطاقة المحفظة غير متاحة لهذه البطاقة." },
      { status: 404, headers: NO_STORE },
    );
  }

  const bytes = new Uint8Array(Buffer.from(base64, "base64"));

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Length": String(bytes.byteLength),
      ...NO_STORE,
    },
  });
}
