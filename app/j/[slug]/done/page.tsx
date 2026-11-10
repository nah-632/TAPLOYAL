import Link from "next/link";
import QRCode from "qrcode";

import { AddToWallet } from "../../../_components/add-to-wallet";
import { SuccessIcon } from "../../../_components/icons";
import { serverOrigin } from "@/modules/site-url";

/**
 * "You're In!" — BUILD-PROMPT §3.C steps 9-12 and §4 screens 4-5.
 *
 * WALLET STEP (updated): passes ARE issued now — through the hosted wallet
 * provider, which signs Apple passes with its own Pass Type ID and mints Google
 * save links from its own issuer, so no Apple or Google developer account is
 * needed. The section below issues the pass on view and links to our own routes.
 *
 * The browser card §3.C requires as a fallback is still there and still the
 * primary action: the wallet step is an addition, never a dependency.
 */
export const dynamic = "force-dynamic";

export default async function DonePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string; again?: string }>;
}) {
  const { t, again } = await searchParams;
  const token = t ?? "";

  const origin = token ? await serverOrigin() : "";
  const cardUrl = origin && token ? `${origin}/c/${encodeURIComponent(token)}` : "";
  const qrDataUrl = cardUrl
    ? await QRCode.toDataURL(cardUrl, { margin: 1, width: 224, errorCorrectionLevel: "M" })
    : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-teal/30 text-teal">
          <SuccessIcon className="h-9 w-9" />
        </span>
        <h1 className="font-arabic-display text-page-title">
          {again === "1" ? "بطاقتك موجودة" : "تم!"}
        </h1>
        <p className="text-slate">
          {again === "1"
            ? "هذا الرقم مسجّل لدينا بالفعل — هذه بطاقتك نفسها، ولم نُنشئ بطاقة ثانية."
            : "تمت إضافة بطاقة الولاء بنجاح."}
        </p>
      </div>

      {token ? (
        <>
          <Link
            href={`/c/${encodeURIComponent(token)}`}
            className="rounded-pill bg-navy px-6 py-3 font-medium text-warm-white"
          >
            عرض البطاقة
          </Link>
          <AddToWallet token={token} qrDataUrl={qrDataUrl} />
        </>
      ) : (
        <p className="text-note text-error">تعذّر إنشاء رابط البطاقة.</p>
      )}

      <Link href="/" className="text-note text-teal underline underline-offset-4">
        taployal
      </Link>
    </main>
  );
}
