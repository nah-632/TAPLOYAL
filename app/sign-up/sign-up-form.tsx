"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/identity/client";
import { ErrorIcon } from "../_components/icons";

/**
 * Merchant sign-up — BUILD-PROMPT §3.A step 3.
 *
 * `autoSignIn` is false on the server, so a successful sign-up deliberately
 * does not create a session: the merchant is sent to sign in. When email
 * verification is enabled the sign-in step is what proves the mailbox.
 */
export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const data = new FormData(event.currentTarget);
    const { error: err } = await signUp.email({
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
    });

    if (err) {
      // Deliberately generic for credential-type failures, specific for input
      // problems the merchant can actually fix.
      setError(err.message ?? "تعذّر إنشاء الحساب. تحقق من البيانات وحاول مرة أخرى.");
      setBusy(false);
      return;
    }

    router.push("/sign-in?next=%2Fonboarding&created=1");
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-note font-medium">الاسم الكامل</span>
        <input
          name="name"
          required
          autoComplete="name"
          className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy outline-none focus-visible:border-teal"
        />
      </label>

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
          minLength={10}
          autoComplete="new-password"
          dir="ltr"
          className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy outline-none focus-visible:border-teal"
        />
        <span className="text-note text-slate">١٠ أحرف على الأقل.</span>
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-card border border-error/30 bg-error/10 px-4 py-3 text-note text-error"
        >
          <ErrorIcon /> {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-pill bg-navy px-6 py-3 font-medium text-warm-white disabled:opacity-60"
      >
        {busy ? "جارٍ الإنشاء…" : "إنشاء الحساب"}
      </button>
    </form>
  );
}
