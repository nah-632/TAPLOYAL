"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/identity/client";

/** Sign-out control — required by BUILD-PROMPT §12.A ("can sign in and sign out"). */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut();
        router.push("/");
        router.refresh();
      }}
      className="rounded-pill border border-navy/20 px-5 py-2 text-note font-medium text-navy disabled:opacity-60"
    >
      {busy ? "…" : "تسجيل الخروج"}
    </button>
  );
}
