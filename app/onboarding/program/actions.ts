"use server";

import { redirect } from "next/navigation";

import type { StampIconKey } from "@/palette";
import { STAMP_ICONS } from "@/palette";
import { getOrCreateDraftCard, updateCard } from "@/identity/merchant-repo";
import { requireTenant } from "@/identity/server-session";

/**
 * Wizard step 3 — BUILD-PROMPT §3.A steps 9-10: the program type (stamp based
 * or points based) and the rule that earns stamps or points.
 */
const ICON_KEYS = new Set<string>(STAMP_ICONS.map((i) => i.key));

export async function saveProgram(formData: FormData): Promise<void> {
  const session = await requireTenant("/onboarding/program");

  const name = String(formData.get("name") ?? "").trim();
  const mode = String(formData.get("mode") ?? "");
  const termsText = String(formData.get("description") ?? "").trim();

  if (name.length < 2 || name.length > 80) redirect("/onboarding/program?error=name");
  if (mode !== "stamps" && mode !== "points") redirect("/onboarding/program?error=mode");

  let stampsRequired: number | null = null;
  let stampIcon: string | null = null;
  let pointsPerUnit: number | null = null;

  if (mode === "stamps") {
    stampsRequired = Number(formData.get("stampsRequired"));
    if (!Number.isInteger(stampsRequired) || stampsRequired < 2 || stampsRequired > 24) {
      redirect("/onboarding/program?error=stamps");
    }
    const icon = String(formData.get("stampIcon") ?? "");
    if (!ICON_KEYS.has(icon)) redirect("/onboarding/program?error=icon");
    stampIcon = icon as StampIconKey;
  } else {
    pointsPerUnit = Number(formData.get("pointsPerUnit"));
    if (!Number.isInteger(pointsPerUnit) || pointsPerUnit < 1 || pointsPerUnit > 1000) {
      redirect("/onboarding/program?error=points");
    }
  }

  const card = await getOrCreateDraftCard(session);
  await updateCard(session, card.id, {
    name,
    mode,
    stampsRequired,
    stampIcon,
    pointsPerUnit,
    termsText: termsText || null,
  });

  redirect("/onboarding/preview");
}
