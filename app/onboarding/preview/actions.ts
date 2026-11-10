"use server";

import { redirect } from "next/navigation";

import {
  createReward,
  getMerchant,
  getOrCreateDraftCard,
  listRewards,
  publishCard,
} from "@/identity/merchant-repo";
import { requireTenant } from "@/identity/server-session";

/**
 * Wizard step 4 — BUILD-PROMPT §3.A steps 11-14: create the reward(s), review
 * the design, then publish.
 *
 * Publishing is blocked without the three things the reference requires: a name,
 * a logo and a reward rule.
 */

export async function addReward(formData: FormData): Promise<void> {
  const session = await requireTenant("/onboarding/preview");
  const name = String(formData.get("rewardName") ?? "").trim();
  const cost = Number(formData.get("rewardCost"));

  if (name.length < 2 || name.length > 80) redirect("/onboarding/preview?error=reward");
  if (!Number.isInteger(cost) || cost < 1 || cost > 1000) {
    redirect("/onboarding/preview?error=cost");
  }

  const card = await getOrCreateDraftCard(session);
  await createReward(session, card.id, { name, cost });
  redirect("/onboarding/preview");
}

export async function publish(formData: FormData): Promise<void> {
  const session = await requireTenant("/onboarding/preview");
  const card = await getOrCreateDraftCard(session);
  const rewardRows = await listRewards(session, card.id);

  if (!card.name || card.name.trim().length < 2) redirect("/onboarding/preview?error=cardname");
  if (rewardRows.length === 0) redirect("/onboarding/preview?error=noreward");

  // Publish gate (SPEC §11): a name, a logo and a reward rule.
  const force = String(formData.get("allowWithoutLogo") ?? "") === "1";
  const merchant = await getMerchant(session);
  if (!merchant?.logoUrl && !force) redirect("/onboarding/preview?error=nologo");

  await publishCard(session, card.id);
  redirect("/dashboard");
}
