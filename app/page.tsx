import Link from "next/link";

/**
 * T0.1 placeholder landing page. The real marketing site is Phase 7 (SPEC §4).
 * Its only job now: prove the token + font pipeline renders in Arabic RTL.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      {/*
        The supplied logo contains the mark, the lowercase wordmark AND the
        tagline, so it replaces all three. Never redraw it (BUILD-PROMPT §10.3 of
        the earlier spec; the new reference says the same: the mark is provided,
        not recreated). A plain <img> is used deliberately — it needs no image
        optimizer at runtime in the standalone container.
      */}
      <img
        src="/brand/taployal-logo.png"
        alt="taployal — Tap. Collect. Redeem."
        width={277}
        height={106}
        className="h-auto w-[210px] sm:w-[270px]"
      />

      <p className="max-w-prose text-section text-navy/70">
        منصة ولاء رقمية للتجّار: بطاقة ولاء بهويتك البصرية، تُضاف إلى محفظة العميل
        بلمسة واحدة، بلا تطبيق.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/style"
          className="rounded-pill bg-navy px-6 py-3 font-medium text-warm-white transition-opacity hover:opacity-90"
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
