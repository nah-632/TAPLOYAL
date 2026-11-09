"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/identity/client";

/**
 * Sign-in — BUILD-PROMPT §3.A step 3 and §12.A ("can sign in and sign out").
 *
 * After success the session cookie exists, so the server decides where the
 * merchant belongs: /onboarding when no business has been created yet, else
 * /dashboard. That decision is never taken from this form.
 */
export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const justCreated = params.get("created") === "1";
  const next = params.get("next");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const data = new FormData(event.currentTarget);
    const { error: err } = await signIn.email({
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
    });

    if (err) {
      // One message for every credential failure: never reveal whether the
      // address exists.
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      setBusy(false);
      return;
    }

    router.push(next && next.startsWith("/") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
      {justCreated && (
        <p
          role="status"
          className="rounded-card border border-success/30 bg-success/10 px-4 py-3 text-note text-navy"
        >
          <span aria-hidden>✓</span> تم إنشاء الحساب. سجّل الدخول للمتابعة.
        </p>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-note font-medium">البريد الإلكتروني</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy outline-none focus-visible:border-teal"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-note font-medium">كلمة المرور</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          dir="ltr"
          className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy outline-none focus-visible:border-teal"
        />
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-card border border-error/30 bg-error/10 px-4 py-3 text-note text-error"
        >
          <span aria-hidden>✕</span> {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-pill bg-navy px-6 py-3 font-medium text-warm-white disabled:opacity-60"
      >
        {busy ? "جارٍ الدخول…" : "تسجيل الدخول"}
      </button>
    </form>
  );
}
