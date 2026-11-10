"use server";

import { redirect } from "next/navigation";

import { createMerchantForOwner, OnboardingError } from "@/identity/onboarding";
import { getServerSession, getTenantSession } from "@/identity/server-session";

/**
 * Setup wizard, step 1 — BUILD-PROMPT §3.A steps 5-6:
 * "يدخل إلى معالج الإعداد الأولي" then "يحدد اسم النشاط التجاري ونوعه ودولة التشغيل".
 *
 * The tenant is never taken from the form: `createMerchantForOwner` generates
 * the merchant id on the server and scopes the transaction to it, which is why
 * this works under RLS without any privilege escalation (ADR-001 §17).
 */

const BUSINESS_TYPES = new Set([
  "cafe",
  "restaurant",
  "salon",
  "retail",
  "specialty",
  "other",
]);

const COUNTRIES = new Set(["BH", "SA", "AE", "KW", "QA", "OM"]);
const CURRENCIES: Record<string, string> = {
  BH: "BHD",
  SA: "SAR",
  AE: "AED",
  KW: "KWD",
  QA: "QAR",
  OM: "OMR",
};

export async function createBusiness(formData: FormData): Promise<void> {
  const user = await getServerSession();
  if (!user) redirect("/sign-in?next=%2Fonboarding");

  // Already onboarded? Nothing to create.
  if (await getTenantSession()) redirect("/dashboard");

  const businessName = String(formData.get("businessName") ?? "").trim();
  const businessType = String(formData.get("businessType") ?? "");
  const country = String(formData.get("country") ?? "BH");
  const city = String(formData.get("city") ?? "").trim();

  // Validate on the server: the browser's `required` attributes are a
  // convenience, never a control.
  if (businessName.length < 2 || businessName.length > 120) redirect("/onboarding?error=name");
  if (!BUSINESS_TYPES.has(businessType)) redirect("/onboarding?error=type");
  if (!COUNTRIES.has(country)) redirect("/onboarding?error=country");

  try {
    await createMerchantForOwner({
      userId: user.id,
      email: user.email,
      merchantName: businessName,
      businessType,
      country,
      city: city || undefined,
      currency: CURRENCIES[country] ?? "BHD",
    });
  } catch (error) {
    if (error instanceof OnboardingError) redirect("/onboarding?error=taken");
    throw error;
  }

  redirect("/onboarding/brand");
}
