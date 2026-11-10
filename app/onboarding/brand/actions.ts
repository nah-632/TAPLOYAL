"use server";

import { redirect } from "next/navigation";

import { normalizeHexColor } from "@/palette";
import { getOrCreateDraftCard, updateBranding, updateCard } from "@/identity/merchant-repo";
import { requireTenant } from "@/identity/server-session";
import { getStorage, StorageError } from "@/storage";

/**
 * Wizard step 2 — BUILD-PROMPT §3.A steps 7-8: "يرفع الشعار" then "يختار ألوان
 * البطاقة". The tenant comes from the session, never from the form.
 */
export async function saveBranding(formData: FormData): Promise<void> {
  const session = await requireTenant("/onboarding/brand");

  const primaryColor = normalizeHexColor(formData.get("primaryColor"));
  const secondaryColor = normalizeHexColor(formData.get("secondaryColor"));
  const textColor = normalizeHexColor(formData.get("textColor"));
  if (!primaryColor || !secondaryColor || !textColor) {
    redirect("/onboarding/brand?error=color");
  }

  // The logo arrives as a data URL produced by the client-side canvas resize.
  // The server re-validates it through the storage layer; the browser's resize
  // is a convenience, not a control.
  let logoUrl: string | undefined;
  const submitted = String(formData.get("logoDataUrl") ?? "").trim();
  if (submitted) {
    try {
      const asset = await getStorage().putPublicAsset({
        dataUrl: submitted,
        ownerId: session.merchantId!,
        kind: "merchant-logo",
      });
      logoUrl = asset.ref;
    } catch (error) {
      if (error instanceof StorageError) redirect("/onboarding/brand?error=logo");
      throw error;
    }
  }

  await updateBranding(session, {
    primaryColor,
    secondaryColor,
    ...(logoUrl ? { logoUrl } : {}),
  });

  const card = await getOrCreateDraftCard(session);
  await updateCard(session, card.id, { labelColor: textColor });

  redirect("/onboarding/program");
}
