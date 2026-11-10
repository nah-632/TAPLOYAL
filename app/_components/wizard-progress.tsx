import { Check } from "lucide-react";

/**
 * Wizard progress — BUILD-PROMPT §3.A steps 5-13 describe a four-step setup.
 * Kept in one place so the four routes cannot drift out of sync, and so the
 * step number shown to the merchant is always accurate.
 */

export const WIZARD_STEPS = [
  { step: 1, path: "/onboarding", label: "النشاط التجاري" },
  { step: 2, path: "/onboarding/brand", label: "الشعار والألوان" },
  { step: 3, path: "/onboarding/program", label: "نظام الولاء" },
  { step: 4, path: "/onboarding/preview", label: "المعاينة والنشر" },
] as const;

export function WizardProgress({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-note">
      {WIZARD_STEPS.map((s) => {
        const done = s.step < current;
        const active = s.step === current;
        return (
          <li key={s.step} className="flex items-center gap-2">
            <span
              aria-hidden
              className={
                "flex h-6 w-6 items-center justify-center rounded-full text-note " +
                (done
                  ? "bg-teal text-warm-white"
                  : active
                    ? "bg-navy text-warm-white"
                    : "border border-navy/25 text-slate")
              }
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden strokeWidth={3} /> : s.step}
            </span>
            <span className={active ? "font-medium text-navy" : "text-slate"}>{s.label}</span>
            {s.step < WIZARD_STEPS.length && <span className="text-navy/20">—</span>}
          </li>
        );
      })}
    </ol>
  );
}
