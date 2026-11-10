"use client";

import { useState } from "react";

import { SubmitButton } from "../../_components/submit-button";
import { joinProgramAction } from "./actions";

/**
 * Join form — BUILD-PROMPT §3.C steps 4-5: consent to the terms and privacy
 * policy, then the required details.
 *
 * Consent is a separate, explicit checkbox that the server re-checks; the submit
 * button stays disabled until it is ticked so the requirement is visible before
 * the customer hits an error.
 */
export function JoinForm({ slug }: { slug: string }) {
  const [consent, setConsent] = useState(false);

  return (
    <form action={joinProgramAction} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={slug} />

      <label className="flex flex-col gap-2">
        <span className="text-note font-medium">الاسم</span>
        <input
          name="fullName"
          required
          minLength={2}
          maxLength={80}
          autoComplete="given-name"
          className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy outline-none focus-visible:border-teal"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-note font-medium">رقم الهاتف</span>
        <input
          name="phone"
          required
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          placeholder="+973 3xxx xxxx"
          className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy outline-none focus-visible:border-teal"
        />
        <span className="text-note text-slate">يُستخدم لمنع تكرار البطاقة فقط.</span>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-note font-medium">البريد الإلكتروني (اختياري)</span>
        <input
          name="email"
          type="email"
          dir="ltr"
          className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy outline-none focus-visible:border-teal"
        />
      </label>

      <label className="flex items-start gap-3 rounded-card border border-navy/15 bg-warm-white p-4">
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1"
        />
        <span className="text-note text-slate">
          أوافق على جمع اسمي ورقم هاتفي لإدارة برنامج الولاء، وعلى سياسة الخصوصية. لا
          نجمع موقعك ولا نتبعه.
        </span>
      </label>

      {!consent && <p className="text-note text-slate">يجب الموافقة على الشروط للمتابعة.</p>}

      <SubmitButton label="أضف بطاقة الولاء" busyLabel="جارٍ الإنشاء…" />
    </form>
  );
}
