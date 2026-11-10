import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { AddToWallet } from "../../_components/add-to-wallet";
import { WalletCardPreview } from "../../_components/wallet-card-preview";
import { getPassByToken } from "@/modules/enrollment";
import { serverOrigin } from "@/modules/site-url";

/**
 * Card web view — BUILD-PROMPT §3.C step 12 ("يستطيع الاطلاع على رصيده
 * ومكافآته") and §4 screens 6-7.
 *
 * Token-protected and deliberately minimal: app_pass_by_token() returns only the
 * first name, balance, serial and programme identity. No phone, no email, and an
 * invalid or expired token shows a generic 404 so it never reveals whether a
 * card exists.
 */
export const dynamic = "force-dynamic";

export default async function CardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: routeToken } = await params;

  // ENCODING BOUNDARY (bug fixed 2026-11-10): Next returns a dynamic PATH segment
  // still percent-encoded, while a query parameter arrives already decoded. Decode
  // exactly once here and treat `token` as the plain token everywhere below, so
  // every URL built from it is encoded exactly once. Miss this and the token is
  // double-encoded (%252F), the pass lookup hashes the wrong string, and every
  // wallet link and QR code silently 404s — which is what happens for most
  // base64 tokens, since they contain "+", "/" and "=".
  const token = decodeURIComponent(routeToken);
  const card = await getPassByToken(token);
  if (!card) notFound();

  // Desktop falls back to scanning: the QR points at this same page on the
  // customer's own origin, so the phone lands on a page that already knows how
  // to pick the right wallet. Pointing it at the provider's page would leak the
  // journey out of our domain for no benefit.
  const origin = await serverOrigin();
  const cardUrl = origin ? `${origin}/c/${encodeURIComponent(token)}` : "";
  const qrDataUrl = cardUrl
    ? await QRCode.toDataURL(cardUrl, { margin: 1, width: 224, errorCorrectionLevel: "M" })
    : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <p className="text-note text-slate">بطاقة الولاء</p>
        <h1 className="text-page-title">أهلًا {card.firstName}</h1>
      </div>

      <WalletCardPreview
        businessName={card.businessName}
        programName={card.programName}
        logoUrl={card.logoUrl}
        primaryColor={card.primaryColor}
        secondaryColor={card.secondaryColor}
        textColor={card.textColor}
        mode={card.mode}
        stampsRequired={card.stampsRequired}
        stampIcon={card.stampIcon}
        sampleBalance={card.balance}
      />

      <dl className="grid grid-cols-2 gap-3 text-note">
        <div className="flex flex-col gap-1 rounded-card border border-navy/10 bg-warm-white p-4">
          <dt className="text-slate">{card.mode === "stamps" ? "الأختام" : "النقاط"}</dt>
          <dd className="text-section font-medium text-navy">{card.balance}</dd>
        </div>
        <div className="flex flex-col gap-1 rounded-card border border-navy/10 bg-warm-white p-4">
          <dt className="text-slate">رقم البطاقة</dt>
          <dd dir="ltr" className="font-mono text-note text-navy">
            {card.serialNumber}
          </dd>
        </div>
      </dl>

      <p className="text-note text-slate">
        الرصيد يُحدَّث عند كل عملية يسجّلها الموظف. هذا الرابط خاص بك — لا تشاركه.
      </p>

      <AddToWallet token={token} qrDataUrl={qrDataUrl} />

      <Link href="/" className="text-note text-teal underline underline-offset-4">
        taployal
      </Link>
    </main>
  );
}
