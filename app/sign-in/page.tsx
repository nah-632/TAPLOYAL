import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getServerSession } from "@/identity/server-session";
import { SignInForm } from "./sign-in-form";

/** Sign-in — BUILD-PROMPT §4 ("Sign in" page). */
export default async function SignInPage() {
  if (await getServerSession()) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-14">
      <img
        src="/brand/taployal-logo.png"
        alt="taployal"
        width={277}
        height={106}
        className="h-auto w-[180px]"
      />

      <div className="flex flex-col gap-2">
        <h1 className="text-page-title">تسجيل الدخول</h1>
        <p className="text-slate">أدخل بياناتك للمتابعة إلى لوحة التحكم.</p>
      </div>

      {/* useSearchParams needs a Suspense boundary during prerendering. */}
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>

      <p className="text-note text-slate">
        لا تملك حسابًا؟{" "}
        <Link href="/sign-up" className="text-teal underline underline-offset-4">
          أنشئ حسابًا
        </Link>
      </p>
    </main>
  );
}
