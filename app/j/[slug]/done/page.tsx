import Link from "next/link";

import { SuccessIcon, WarningIcon } from "../../../_components/icons";

/**
 * "You're In!" — BUILD-PROMPT §3.C steps 9-12 and §4 screens 4-5.
 *
 * WALLET HONESTY: the reference asks for "Add to Apple Wallet" / "Add to Google
 * Wallet" badges, and it also forbids modifying the official badges and claiming
 * an integration works before testing it. No Pass Type ID certificate and no
 * Google Wallet Issuer exist yet, so real passes cannot be issued. Rather than
 * render a badge that cannot work, this shows the wallet step as pending and
 * gives the browser card, which §3.C explicitly requires as the fallback:
 * "يجب توفير تجربة بديلة عبر المتصفح".
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
        <Link
          href={`/c/${encodeURIComponent(token)}`}
          className="rounded-pill bg-navy px-6 py-3 font-medium text-warm-white"
        >
          عرض البطاقة
        </Link>
      ) : (
        <p className="text-note text-error">تعذّر إنشاء رابط البطاقة.</p>
      )}

      <section className="flex flex-col gap-3 rounded-container border border-navy/10 bg-warm-white p-5 text-start">
        <h2 className="text-section">إضافتها إلى المحفظة</h2>
        <p className="flex items-start gap-2 text-note text-warning">
          <WarningIcon className="mt-0.5" />
          <span>
            إصدار بطاقة Apple Wallet وGoogle Wallet يتطلب حسابات المطوّر الرسمية، ولم
            تُفعَّل بعد — لذلك لا نعرض شعار «أضف إلى المحفظة» وهو لا يعمل.
          </span>
        </p>
        <p className="text-note text-slate">
          استخدم «عرض البطاقة» الآن؛ سيعمل الرابط نفسه عبر المتصفح على أي جهاز، وهو
          البديل الذي يتطلبه المرجع.
        </p>
      </section>

      <Link href="/" className="text-note text-teal underline underline-offset-4">
        taployal
      </Link>
    </main>
  );
}
