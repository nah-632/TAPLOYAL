import Link from "next/link";
import { redirect } from "next/navigation";

import { SubmitButton } from "../../_components/submit-button";
import { WalletCardPreview } from "../../_components/wallet-card-preview";
import { WizardProgress } from "../../_components/wizard-progress";
import { DEFAULT_CARD_COLORS } from "@/palette";
import {
  getMerchant,
  getOrCreateDraftCard,
  listRewards,
} from "@/identity/merchant-repo";
import { requireTenant } from "@/identity/server-session";
import { addReward, publish } from "./actions";
import { ErrorIcon, WarningIcon } from "../../_components/icons";

/** Wizard step 4 — BUILD-PROMPT §3.A steps 11-14. */
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  reward: "اسم المكافأة مطلوب.",
  cost: "تكلفة المكافأة يجب أن تكون رقمًا بين ١ و١٠٠٠.",
  cardname: "اسم البرنامج مطلوب قبل النشر.",
  noreward: "أضف مكافأة واحدة على الأقل قبل النشر.",
  nologo: "النشر يتطلب شعارًا. ارفع الشعار في الخطوة ٢، أو أكّد المتابعة بدونه.",
};

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireTenant("/onboarding/preview");
  const merchant = await getMerchant(session);
  if (!merchant) redirect("/onboarding");

  const card = await getOrCreateDraftCard(session);
  const rewardRows = await listRewards(session, card.id);
  const { error } = await searchParams;

  const primaryColor = merchant.primaryColor ?? DEFAULT_CARD_COLORS.primaryColor;
  const secondaryColor = merchant.secondaryColor ?? DEFAULT_CARD_COLORS.secondaryColor;
  const textColor = card.labelColor ?? DEFAULT_CARD_COLORS.textColor;

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-3">
        <WizardProgress current={4} />
        <h1 className="text-page-title">المعاينة والنشر</h1>
        <p className="text-slate">
          راجع البطاقة، أضف مكافآت البرنامج، ثم اعتمد التصميم.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-card border border-error/30 bg-error/10 px-4 py-3 text-note text-error"
        >
          <ErrorIcon /> {ERRORS[error] ?? "تعذّر إكمال الخطوة."}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h2 className="text-section">البطاقة</h2>
          <WalletCardPreview
            businessName={merchant.businessName}
            programName={card.name || "برنامج الولاء"}
            description={card.termsText}
            logoUrl={merchant.logoUrl}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            textColor={textColor}
            mode={card.mode}
            stampsRequired={card.stampsRequired}
            stampIcon={card.stampIcon}
          />
          <p className="text-note text-slate">
            معاينة تقريبية. Apple Wallet وGoogle Wallet يتحكمان ببعض عناصر العرض
            النهائي، ولا يمكن مطابقة المعاينة بنسبة ١٠٠٪.
          </p>
          <Link href="/onboarding/program" className="text-teal underline underline-offset-4">
            → تعديل نظام الولاء
          </Link>
        </div>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="text-section">المكافآت</h2>
            {rewardRows.length === 0 ? (
              <p className="rounded-card border border-dashed border-navy/20 px-4 py-4 text-note text-slate">
                لا مكافآت بعد. النشر يتطلب مكافأة واحدة على الأقل.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {rewardRows.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-card border border-navy/10 bg-warm-white px-4 py-3 text-note"
                  >
                    <span className="font-medium">{r.name}</span>
                    <span className="text-slate">
                      {r.cost} {card.mode === "stamps" ? "ختمًا" : "نقطة"}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <form action={addReward} className="flex flex-wrap items-end gap-3">
              <label className="flex flex-1 flex-col gap-2">
                <span className="text-note font-medium">اسم المكافأة</span>
                <input
                  name="rewardName"
                  required
                  maxLength={80}
                  placeholder="مثال: قهوة مجانية"
                  className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy"
                />
              </label>
              <label className="flex w-28 flex-col gap-2">
                <span className="text-note font-medium">
                  {card.mode === "stamps" ? "الأختام" : "النقاط"}
                </span>
                <input
                  name="rewardCost"
                  type="number"
                  min={1}
                  max={1000}
                  defaultValue={card.mode === "stamps" ? (card.stampsRequired ?? 8) : 100}
                  className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy"
                />
              </label>
              <SubmitButton
                label="أضف"
                busyLabel="…"
                className="rounded-pill border border-navy/25 px-5 py-3 font-medium text-navy disabled:opacity-60"
              />
            </form>
          </section>

          <section className="flex flex-col gap-3 rounded-container border border-navy/10 bg-warm-white p-5">
            <h2 className="text-section">اعتماد التصميم</h2>
            {!merchant.logoUrl && (
              <p className="text-note text-warning">
                <WarningIcon /> لا يوجد شعار بعد — تخزين الملفات غير
                مُهيَّأ على الخطة الحالية، ويمكنك الاعتماد بدونه مؤقتًا.
              </p>
            )}
            <form action={publish} className="flex flex-col gap-3">
              {!merchant.logoUrl && (
                <label className="flex items-center gap-2 text-note">
                  <input type="checkbox" name="allowWithoutLogo" value="1" />
                  أُتابع بدون شعار الآن
                </label>
              )}
              <SubmitButton label="اعتماد التصميم ونشر البطاقة" busyLabel="جارٍ النشر…" />
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
