"use server";

import { redirect } from "next/navigation";

import { EnrollmentError, joinProgram, normalizePhone } from "@/modules/enrollment";

/**
 * Public join action — BUILD-PROMPT §3.C steps 4-8.
 *
 * This is the only unauthenticated WRITE in the product. It validates on the
 * server, requires explicit consent, and delegates the atomic work (rate limit,
 * customer upsert, pass issuance, wallet job) to app_join_program() so a partial
 * join can never exist.
 *
 * The merchant is identified by the slug in the URL — never by anything the
 * client claims about tenancy.
 */
export async function joinProgramAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "").trim();
  const back = `/j/${encodeURIComponent(slug)}`;

  if (!/^[a-z0-9-]{2,60}$/.test(slug)) redirect("/");

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const consent = String(formData.get("consent") ?? "") === "on";

  if (fullName.length < 2 || fullName.length > 80) redirect(`${back}?error=name`);
  const phone = normalizePhone(phoneRaw);
  if (!phone) redirect(`${back}?error=phone`);
  // Consent is a real control, not a checkbox we hope was ticked.
  if (!consent) redirect(`${back}?error=consent`);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect(`${back}?error=email`);

  let token: string;
  let again: boolean;
  try {
    const result = await joinProgram({ slug, fullName, phone, email, consent });
    token = result.webViewToken;
    again = result.alreadyExisted;
  } catch (error) {
    if (error instanceof EnrollmentError) {
      const code =
        error.kind === "rate_limited" ? "busy" : error.kind === "not_found" ? "gone" : "invalid";
      redirect(`${back}?error=${code}`);
    }
    throw error;
  }

  // The view token is the customer's only key to their card, so it is passed
  // once through the redirect and never stored in plaintext anywhere.
  redirect(`${back}/done?t=${encodeURIComponent(token)}${again ? "&again=1" : ""}`);
}
