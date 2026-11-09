import Link from "next/link";
import { redirect } from "next/navigation";

import { getServerSession } from "@/identity/server-session";
import { SignUpForm } from "./sign-up-form";

/** Merchant sign-up — BUILD-PROMPT §3.A steps 2-3, §4 (Sign up page). */
export default async function SignUpPage() {
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
        <h1 className="text-page-title">أنشئ حسابك</h1>
        <p className="text-slate">ابدأ مجانًا وأطلق برنامج الولاء في دقائق.</p>
      </div>

      <SignUpForm />

      <p className="text-note text-slate">
        لديك حساب بالفعل؟{" "}
        <Link href="/sign-in" className="text-teal underline underline-offset-4">
          تسجيل الدخول
        </Link>
      </p>
    </main>
  );
}
