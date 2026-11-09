import Link from "next/link";

/**
 * T0.1 placeholder landing page. The real marketing site is Phase 7 (SPEC §4).
 * Its only job now: prove the token + font pipeline renders in Arabic RTL.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <p className="text-note font-medium tracking-[0.3em] text-gold uppercase">
        TAP. COLLECT. REDEEM.
      </p>

      <h1 className="font-arabic-display text-hero-mobile text-navy sm:text-hero">
        taployal
      </h1>

      <p className="max-w-prose text-section text-navy/70">
        منصة ولاء رقمية للتجّار: بطاقة ولاء بهويتك البصرية، تُضاف إلى محفظة العميل
        بلمسة واحدة، بلا تطبيق.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/style"
          className="rounded-pill bg-navy px-6 py-3 font-medium text-cream transition-opacity hover:opacity-90"
        >
          صفحة الهوية (Style)
        </Link>
        {/*
          There was a second link to /ar/style. Locale routing (T0.4) is not
          built yet, so that route does not exist and the link returned 404 —
          the reason every link on this page was broken in production.
          tools/check-routes.mjs now fails the build if an internal href has no
          matching route file, so this cannot recur silently.
        */}
      </div>

      <p className="text-note text-navy/50">
        Phase 0 — foundation · بطاقة الحالة: قيد البناء
      </p>
    </main>
  );
}
