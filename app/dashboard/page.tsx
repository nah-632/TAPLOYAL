import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";

import { getMerchant } from "@/identity/merchant-repo";
import { requireTenant } from "@/identity/server-session";
import { SignOutButton } from "./sign-out-button";

/**
 * Per-user page: it reads the session cookie, so it must never be prerendered.
 * Declared explicitly because Next otherwise tried to generate it at build
 * time, where runtime secrets (BETTER_AUTH_SECRET) do not exist — the build
 * failed with "BETTER_AUTH_SECRET must be set in production".
 */
export const dynamic = "force-dynamic";

/**
 * Dashboard shell — the entry point of BUILD-PROMPT §4 (dashboard) and the
 * destination of §3.A step 19.
 *
 * Scope note, stated plainly: this is the SHELL. The sidebar sections the
 * reference lists (Overview, Loyalty Program, Card Designer, Customers,
 * Rewards, Staff, Analytics, Subscription, Settings) are Phase 2 work that is
 * not built yet, so they are shown as not-yet-available rather than as links
 * that would 404 — the defect that broke every link on this site earlier.
 */
export default async function DashboardPage() {
  const session = await requireTenant("/dashboard");
  const merchant = await getMerchant(session);

  // The join link the merchant prints on a poster (§3.A step 15). The host comes
  // from the request so the link is correct on every domain we deploy to.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const joinUrl = merchant?.slug ? `${proto}://${host}/j/${merchant.slug}` : "";
  const qrSvg = joinUrl
    ? await QRCode.toString(joinUrl, { type: "svg", margin: 1, width: 200 })
    : "";

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src="/brand/taployal-logo.png"
            alt="taployal"
            width={277}
            height={106}
            className="h-auto w-[130px]"
          />
          <div>
            <h1 className="text-page-title">{session.email.split("@")[0]}</h1>
            <p className="text-note text-slate">
              {session.role === "staff" ? "موظف" : "مالك النشاط"} · {session.email}
            </p>
          </div>
        </div>
        <SignOutButton />
      </header>

      <section className="rounded-container border border-navy/10 bg-warm-white p-8">
        <h2 className="text-section">تم إنشاء نشاطك التجاري</h2>
        <p className="mt-2 text-slate">
          الخطوة التالية في مرجع البناء هي رفع الشعار واختيار ألوان البطاقة، ثم تحديد
          نظام النقاط أو الأختام — وهذه شاشات Phase 2 لم تُبنَ بعد.
        </p>
        <dl className="mt-6 grid gap-3 text-note sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-slate">معرّف التاجر (من الجلسة، لا من المتصفح)</dt>
            <dd dir="ltr" className="font-mono text-navy">
              {session.merchantId}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-slate">الدور</dt>
            <dd className="font-medium text-navy">{session.role}</dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-4 rounded-container border border-navy/10 bg-warm-white p-6">
        <h2 className="text-section">رابط الانضمام ورمز QR</h2>
        {joinUrl ? (
          <div className="flex flex-wrap items-center gap-6">
            <div
              className="rounded-card bg-warm-white p-2 [&>svg]:h-[200px] [&>svg]:w-[200px]"
              // Library-generated SVG (paths only); no user input reaches it.
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-note text-slate">اطبع هذا الرمز وضعه في متجرك:</p>
              <code dir="ltr" className="truncate rounded-card border border-navy/15 bg-warm-white px-3 py-2 text-note text-navy">
                {joinUrl}
              </code>
              <p className="text-note text-slate">
                يفتح الرابط صفحة الانضمام بهوية نشاطك. لا يحتاج العميل تطبيقًا ولا كلمة
                مرور.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-note text-slate">يظهر الرابط بعد إكمال معالج الإعداد.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section">أقسام لوحة التحكم</h2>
        <p className="text-note text-slate">
          مُدرجة بترتيب مرجع البناء §11.D، وكلٌّ منها لم يُنفَّذ بعد.
        </p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {[
            "Overview",
            "Loyalty Program",
            "Card Designer",
            "Customers",
            "Rewards",
            "Staff",
            "Analytics",
            "Subscription",
            "Settings",
          ].map((item) => (
            <li
              key={item}
              className="flex items-center justify-between rounded-card border border-dashed border-navy/20 px-4 py-3 text-note text-slate"
            >
              <span dir="ltr">{item}</span>
              <span aria-hidden>قيد التنفيذ</span>
            </li>
          ))}
        </ul>
      </section>

      <Link href="/" className="text-teal underline underline-offset-4">
        → الصفحة الرئيسية
      </Link>
    </main>
  );
}
