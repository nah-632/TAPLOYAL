import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Play,
  Square,
  Star,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  X,
} from "lucide-react";

/**
 * SPEC §11 acceptance criterion: "a style page showing every brand token and
 * component". Also T0.9, which stayed unbuilt — and because the landing page
 * linked to it, EVERY link on the site returned 404 in production.
 *
 * Rule this page exists to enforce: all colours and type come from the tokens
 * in app/globals.css. `npm run check:tokens` fails if a hex value appears here.
 */

const COLORS = [
  { name: "Deep Navy", token: "--color-navy", cls: "bg-navy", text: "text-warm-white" },
  { name: "Midnight Blue", token: "--color-midnight", cls: "bg-midnight", text: "text-warm-white" },
  { name: "Electric Teal", token: "--color-teal", cls: "bg-teal", text: "text-warm-white" },
  { name: "Soft Mint", token: "--color-mint", cls: "bg-mint", text: "text-navy" },
  { name: "Warm White", token: "--color-warm-white", cls: "bg-warm-white", text: "text-navy" },
  { name: "Slate Gray", token: "--color-slate", cls: "bg-slate", text: "text-warm-white" },
];

const STATUS = [
  { label: "نجاح", cls: "bg-success/10 text-success border-success/30", Icon: Check },
  { label: "تحذير", cls: "bg-warning/10 text-warning border-warning/30", Icon: TriangleAlert },
  { label: "خطأ", cls: "bg-error/10 text-error border-error/30", Icon: X },
];

export default function StylePage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-12 px-6 py-14">
      <header className="flex flex-col gap-3">
        <img
          src="/brand/taployal-logo.png"
          alt="taployal — Tap. Collect. Redeem."
          width={277}
          height={106}
          className="h-auto w-[200px]"
        />
        <h1 className="text-page-title">نظام الهوية — taployal</h1>
        <p className="text-navy/70">
          كل رمز بصري في المنصة يأتي من مصدر واحد: <code>app/globals.css</code>. لا
          قيمة لون ولا خط خارجها.
        </p>
        <Link href="/" className="text-teal underline underline-offset-4">
          → العودة للصفحة الرئيسية
        </Link>
      </header>

      {/* ── Colours ── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-section">الألوان</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {COLORS.map((c) => (
            <div key={c.token} className="flex flex-col gap-2">
              <div
                className={`${c.cls} ${c.text} flex h-20 items-end rounded-card border border-navy/10 p-3`}
              >
                <span className="text-note font-medium">{c.name}</span>
              </div>
              <code className="text-note text-navy/60">{c.token}</code>
            </div>
          ))}
        </div>
      </section>

      {/* ── Status: colour is always paired with an icon and a label ── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-section">حالات النظام</h2>
        <p className="text-note text-navy/60">
          كل حالة تقترن دائمًا بأيقونة ونص، لا باللون وحده.
        </p>
        <div className="flex flex-wrap gap-3">
          {STATUS.map((s) => (
            <span
              key={s.label}
              className={`${s.cls} inline-flex items-center gap-2 rounded-pill border px-4 py-2 text-note font-medium`}
            >
              <s.Icon className="h-4 w-4" aria-hidden strokeWidth={2} />
              {s.label}
            </span>
          ))}
        </div>
      </section>

      {/* ── Typography ── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-section">الخطوط والمقاييس</h2>
        <div className="flex flex-col gap-3 rounded-card bg-white/60 p-6">
          <p className="font-arabic-display text-page-title">العنوان الرئيسي — Noto Naskh Arabic</p>
          <p className="text-section font-arabic-body">عنوان قسم — IBM Plex Sans Arabic</p>
          <p className="font-arabic-body">نص المتن العربي بحجم 16 بكسل، بلا تباعد حروف.</p>
          <p className="text-note text-navy/60">ملاحظة صغيرة — 13 بكسل</p>
          <p className="font-display text-page-title" dir="ltr">
            Latin heading — Playfair Display
          </p>
          <p className="font-body" dir="ltr">
            Latin body and UI — Inter
          </p>
        </div>
      </section>

      {/* ── Buttons (§10.4) ── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-section">الأزرار</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-pill bg-teal px-6 py-3 font-medium text-warm-white">
            إجراء أساسي على خلفية داكنة <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden strokeWidth={2} />
          </button>
          <button className="rounded-pill bg-navy px-6 py-3 font-medium text-warm-white">
            إجراء أساسي على خلفية فاتحة
          </button>
          <button className="rounded-pill border border-navy/30 px-6 py-3 font-medium text-navy">
            إجراء ثانوي
          </button>
          <button
            aria-label="تشغيل"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-warm-white"
          >
            <Play className="h-4 w-4 rtl:rotate-180" aria-hidden strokeWidth={2} fill="currentColor" />
          </button>
        </div>
        <div className="rounded-container bg-navy p-6">
          <button className="inline-flex items-center gap-2 rounded-pill bg-teal px-6 py-3 font-medium text-warm-white">
            زر ذهبي داخل قسم داكن <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden strokeWidth={2} />
          </button>
        </div>
      </section>

      {/* ── KPI card (§10.4) ── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-section">بطاقة مؤشر</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-4 rounded-card border border-navy/10 bg-white/70 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint text-teal">
              ★
            </span>
            <div>
              <p className="text-page-title leading-none">8,210</p>
              <p className="text-note text-navy/60">إجمالي العملاء</p>
              <p className="text-note font-medium text-success">
                <TrendingUp className="inline h-3.5 w-3.5" aria-hidden strokeWidth={2} /> 18% عن الفترة السابقة
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-card border border-navy/10 bg-white/70 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint text-teal">
              ✕
            </span>
            <div>
              <p className="text-page-title leading-none">1,240</p>
              <p className="text-note text-navy/60">المكافآت المستبدلة</p>
              <p className="text-note font-medium text-error">
                <TrendingDown className="inline h-3.5 w-3.5" aria-hidden strokeWidth={2} /> 4% عن الفترة السابقة
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Form ── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-section">الحقول والنماذج</h2>
        <div className="flex flex-col gap-4 rounded-card border border-navy/10 bg-white/70 p-6">
          <label className="flex flex-col gap-2">
            <span className="text-note font-medium">اسم المتجر</span>
            <input
              className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy outline-none focus-visible:border-teal"
              placeholder="مثال: ريفانو كافيه"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-note font-medium">رسالة القرب (٨٠ حرفًا كحد أقصى)</span>
            <input
              className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy outline-none focus-visible:border-teal"
              placeholder="أنت قريب من ريفانو — لديك ٣ أختام"
            />
            <span className="text-note text-navy/50">٣٤ / ٨٠</span>
          </label>
        </div>
      </section>

      {/* ── Empty state ── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-section">الحالة الفارغة</h2>
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-navy/20 bg-white/50 p-10 text-center">
          <Square className="h-8 w-8 text-slate" aria-hidden strokeWidth={1.5} />
          <p className="text-navy/70">لا توجد مكافآت بعد.</p>
          <button className="rounded-pill bg-navy px-6 py-3 font-medium text-warm-white">
            أضف أول مكافأة
          </button>
        </div>
      </section>

      {/* ── Success screen (§10.4 "You're In!") ── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-section">شاشة النجاح</h2>
        <div className="flex flex-col items-center gap-4 rounded-container bg-warm-white p-10 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-teal/30 text-page-title text-teal">
            ✓
          </span>
          <p className="text-section font-arabic-display">تم!</p>
          <p className="text-navy/70">تمت إضافة بطاقة الولاء بنجاح.</p>
          <button className="rounded-pill bg-navy px-6 py-3 font-medium text-warm-white">
            عرض البطاقة
          </button>
        </div>
      </section>

      {/* ── Radii ── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-section">الانحناءات</h2>
        <div className="flex flex-wrap gap-4">
          <div className="rounded-container border border-navy/15 bg-white/60 p-6 text-note">
            حاويات — 24px
          </div>
          <div className="rounded-card border border-navy/15 bg-white/60 p-6 text-note">
            بطاقات — 16px
          </div>
          <div className="rounded-pill border border-navy/15 bg-white/60 px-8 py-3 text-note">
            أزرار — pill
          </div>
        </div>
      </section>
    </main>
  );
}
