import { redirect } from "next/navigation";

import { getServerSession, getTenantSession } from "@/identity/server-session";
import { createBusiness } from "./actions";

/** Setup wizard — BUILD-PROMPT §3.A steps 5-6, §4 (setup wizard). */

const TYPES = [
  { value: "cafe", label: "مقهى" },
  { value: "restaurant", label: "مطعم" },
  { value: "salon", label: "صالون" },
  { value: "retail", label: "متجر تجزئة" },
  { value: "specialty", label: "متجر متخصّص" },
  { value: "other", label: "أخرى" },
];

const COUNTRIES = [
  { value: "BH", label: "البحرين" },
  { value: "SA", label: "السعودية" },
  { value: "AE", label: "الإمارات" },
  { value: "KW", label: "الكويت" },
  { value: "QA", label: "قطر" },
  { value: "OM", label: "عُمان" },
];

const ERRORS: Record<string, string> = {
  name: "اسم النشاط التجاري مطلوب (حرفان على الأقل).",
  type: "اختر نوع النشاط التجاري.",
  country: "اختر دولة التشغيل.",
  taken: "تعذّر حجز رابط فريد لهذا الاسم. جرّب اسمًا مختلفًا.",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!(await getServerSession())) redirect("/sign-in?next=%2Fonboarding");
  if (await getTenantSession()) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-8 px-6 py-14">
      <div className="flex flex-col gap-3">
        <img
          src="/brand/taployal-logo.png"
          alt="taployal"
          width={277}
          height={106}
          className="h-auto w-[160px]"
        />
        <p className="text-note text-slate">الخطوة ١ من ٤</p>
        <h1 className="text-page-title">عرّفنا على نشاطك التجاري</h1>
        <p className="text-slate">
          هذه البيانات تظهر في بطاقة الولاء وفي صفحة الانضمام.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-card border border-error/30 bg-error/10 px-4 py-3 text-note text-error"
        >
          <span aria-hidden>✕</span> {ERRORS[error] ?? "تعذّر إكمال الخطوة."}
        </p>
      )}

      <form action={createBusiness} className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-note font-medium">اسم النشاط التجاري</span>
          <input
            name="businessName"
            required
            minLength={2}
            maxLength={120}
            placeholder="مثال: ريفانو كافيه"
            className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy outline-none focus-visible:border-teal"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-note font-medium">نوع النشاط</span>
          <select
            name="businessType"
            required
            defaultValue=""
            className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy outline-none focus-visible:border-teal"
          >
            <option value="" disabled>
              اختر النوع…
            </option>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-note font-medium">دولة التشغيل</span>
            <select
              name="country"
              required
              defaultValue="BH"
              className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy outline-none focus-visible:border-teal"
            >
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-note font-medium">المدينة (اختياري)</span>
            <input
              name="city"
              className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy outline-none focus-visible:border-teal"
            />
          </label>
        </div>

        <p className="text-note text-slate">
          العملة تُحدَّد تلقائيًا من الدولة، ويمكن تغييرها لاحقًا من الإعدادات.
        </p>

        <button
          type="submit"
          className="rounded-pill bg-navy px-6 py-3 font-medium text-warm-white"
        >
          متابعة
        </button>
      </form>
    </main>
  );
}
