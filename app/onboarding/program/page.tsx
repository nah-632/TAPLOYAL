import Link from "next/link";
import { redirect } from "next/navigation";

import { WizardProgress } from "../../_components/wizard-progress";
import { DEFAULT_CARD_COLORS } from "@/palette";
import { getMerchant, getOrCreateDraftCard } from "@/identity/merchant-repo";
import { requireTenant } from "@/identity/server-session";
import { ProgramForm } from "./program-form";
import { ErrorIcon } from "../../_components/icons";

/** Wizard step 3 — BUILD-PROMPT §3.A steps 9-10. */
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  name: "اسم البرنامج مطلوب (حرفان على الأقل، ٨٠ حرفًا كحد أقصى).",
  mode: "اختر نوع نظام الولاء.",
  stamps: "عدد الأختام يجب أن يكون بين ٢ و٢٤.",
  icon: "اختر أيقونة ختم.",
  points: "عدد النقاط لكل وحدة يجب أن يكون بين ١ و١٠٠٠.",
};

export default async function ProgramPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireTenant("/onboarding/program");
  const merchant = await getMerchant(session);
  if (!merchant) redirect("/onboarding");

  const card = await getOrCreateDraftCard(session);
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-3">
        <WizardProgress current={3} />
        <h1 className="text-page-title">نظام الولاء</h1>
        <p className="text-slate">حدّد كيف يكسب عميلك المكافأة: بالأختام أو بالنقاط.</p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-card border border-error/30 bg-error/10 px-4 py-3 text-note text-error"
        >
          <ErrorIcon /> {ERRORS[error] ?? "تعذّر إكمال الخطوة."}
        </p>
      )}

      <ProgramForm
        businessName={merchant.businessName}
        initial={{
          name: card.name,
          mode: card.mode,
          stampsRequired: card.stampsRequired,
          stampIcon: card.stampIcon,
          pointsPerUnit: card.pointsPerUnit,
          termsText: card.termsText,
          primaryColor: merchant.primaryColor ?? DEFAULT_CARD_COLORS.primaryColor,
          secondaryColor: merchant.secondaryColor ?? DEFAULT_CARD_COLORS.secondaryColor,
          textColor: card.labelColor ?? DEFAULT_CARD_COLORS.textColor,
          logoUrl: merchant.logoUrl,
        }}
      />

      <Link href="/onboarding/brand" className="text-teal underline underline-offset-4">
        → رجوع إلى الخطوة السابقة
      </Link>
    </main>
  );
}
