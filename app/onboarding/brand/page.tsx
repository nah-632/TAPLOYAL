import Link from "next/link";
import { redirect } from "next/navigation";

import { WizardProgress } from "../../_components/wizard-progress";
import { DEFAULT_CARD_COLORS } from "@/palette";
import { getMerchant, getOrCreateDraftCard } from "@/identity/merchant-repo";
import { requireTenant } from "@/identity/server-session";
import { BrandForm } from "./brand-form";
import { ErrorIcon } from "../../_components/icons";

/** Wizard step 2 — BUILD-PROMPT §3.A steps 7-8, §11.E. */
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  color: "اختر ألوانًا صحيحة (كل لون بصيغة #rrggbb).",
  logo: "تعذّر قبول الصورة: النوع أو الحجم غير مسموح.",
};

export default async function BrandPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireTenant("/onboarding/brand");
  const merchant = await getMerchant(session);
  if (!merchant) redirect("/onboarding");

  const card = await getOrCreateDraftCard(session);
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-3">
        <WizardProgress current={2} />
        <h1 className="text-page-title">شعار النشاط وألوان البطاقة</h1>
        <p className="text-slate">
          هذه الألوان تخصّ بطاقة الولاء الخاصة بعملائك، ولا علاقة لها بهوية منصة
          taployal.
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

      <BrandForm
        businessName={merchant.businessName}
        programName={card.name || "برنامج الولاء"}
        initial={{
          primaryColor: merchant.primaryColor ?? DEFAULT_CARD_COLORS.primaryColor,
          secondaryColor: merchant.secondaryColor ?? DEFAULT_CARD_COLORS.secondaryColor,
          textColor: card.labelColor ?? DEFAULT_CARD_COLORS.textColor,
          logoUrl: merchant.logoUrl,
        }}
      />

      <Link href="/onboarding" className="text-teal underline underline-offset-4">
        → رجوع إلى الخطوة السابقة
      </Link>
    </main>
  );
}
