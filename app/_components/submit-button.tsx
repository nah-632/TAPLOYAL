"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button that reflects the enclosing form's pending state.
 * Used instead of lifting the whole form into useActionState, so the form keeps
 * working before hydration (progressive enhancement) — the earlier hand-rolled
 * submit was the reason a server action appeared to "do nothing" in testing.
 */
export function SubmitButton({
  label,
  busyLabel = "جارٍ الحفظ…",
  className = "rounded-pill bg-navy px-6 py-3 font-medium text-warm-white disabled:opacity-60",
}: {
  label: string;
  busyLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? busyLabel : label}
    </button>
  );
}
