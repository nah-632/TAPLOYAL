import Link from "next/link";
import { notFound } from "next/navigation";

import { ErrorIcon } from "../../_components/icons";
import { getPublicProgram } from "@/modules/enrollment";
import { JoinForm } from "./join-form";

/**
 * Join page — BUILD-PROMPT §3.C steps 1-5 and the first screen of §4's customer
 * interface.
 *
 * PUBLIC by design: no session, and the only data it can reach is what
 * app_public_program() returns (the merchant's own programme, exactly what the
 * poster in the shop already shows).
 */
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  name: "اكتب اسمك (حرفان على الأقل).",
  phone: "رقم الهاتف غير صحيح. مثال: +973 3xxx xxxx",
  consent: "لا يمكن المتابعة بدون الموافقة على الشروط.",
  email: "البريد الإلكتروني غير صحيح.",
  busy: "عدد كبير من التسجيلات الآن. أعد المحاولة بعد قليل.",
  gone: "هذا البرنامج غير متاح حاليًا.",
  invalid: "تعذّر إكمال التسجيل. تحقق من البيانات.",
};

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const program = await getPublicProgram(slug);
  if (!program) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-4">
        {program.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={program.logoUrl} alt="" className="h-14 w-14 rounded-card object-contain" />
        ) : (
          <div
            className="flex h-14 w-14 items-center justify-center rounded-card text-section font-medium"
            style={{ backgroundColor: program.primaryColor, color: program.textColor }}
          >
            {program.businessName.slice(0, 1)}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">{program.businessName}</h1>
          <p className="text-slate">{program.programName || "برنامج الولاء"}</p>
        </div>
        <p
          className="rounded-card px-4 py-3 text-note"
          style={{ backgroundColor: program.primaryColor, color: program.textColor }}
        >
          {program.mode === "stamps"
            ? `اجمع ${program.stampsRequired ?? 8} أختام واحصل على مكافأتك.`
            : "اجمع النقاط مع كل عملية واستبدلها بمكافآت."}
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-card border border-error/30 bg-error/10 px-4 py-3 text-note text-error"
        >
          <ErrorIcon />
          {ERRORS[error] ?? "تعذّر إكمال التسجيل."}
        </p>
      )}

      <JoinForm slug={slug} />

      <p className="text-note text-slate">
        بطاقة ولاء رقمية — بلا تطبيق وبلا كلمة مرور.{" "}
        <Link href="/" className="text-teal underline underline-offset-4">
          taployal
        </Link>
      </p>
    </main>
  );
}
