import { sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { DEFAULT_CARD_COLORS, normalizeHexColor } from "@/palette";

/**
 * Public enrollment — BUILD-PROMPT §3.C (customer journey), §5 (QR enrollment)
 * and §6 (customer management).
 *
 * WHY THIS DOES NOT USE withTenant(): the customer scanning a QR has no session
 * and no tenant. Every call here goes through a narrow SECURITY DEFINER function
 * that exposes only what a poster in the shop already shows, or only the single
 * card the presented token unlocks. Nothing here can enumerate a merchant's
 * customers, passes or transactions.
 */

export interface PublicProgram {
  merchantId: string;
  businessName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  programName: string;
  mode: "points" | "stamps";
  stampsRequired: number | null;
  stampIcon: string | null;
  termsText: string | null;
}

export interface JoinResult {
  serialNumber: string;
  webViewToken: string;
  alreadyExisted: boolean;
  balance: number;
}

export interface PublicCard {
  firstName: string;
  balance: number;
  serialNumber: string;
  businessName: string;
  programName: string;
  mode: "points" | "stamps";
  stampsRequired: number | null;
  stampIcon: string | null;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  logoUrl: string | null;
}

export class EnrollmentError extends Error {
  constructor(message: string, readonly kind: "not_found" | "invalid" | "rate_limited") {
    super(message);
    this.name = "EnrollmentError";
  }
}

/** Maps PostgreSQL SQLSTATEs raised by the functions to user-facing kinds. */
function classify(error: unknown): EnrollmentError {
  const text = String((error as { message?: string })?.message ?? error);
  if (text.includes("too many joins")) return new EnrollmentError("rate limited", "rate_limited");
  if (text.includes("not found") || text.includes("not published")) {
    return new EnrollmentError("programme not found", "not_found");
  }
  return new EnrollmentError(text.slice(0, 200), "invalid");
}

function pickColors(primary: unknown, secondary: unknown, label: unknown) {
  return {
    primaryColor: normalizeHexColor(primary) ?? DEFAULT_CARD_COLORS.primaryColor,
    secondaryColor: normalizeHexColor(secondary) ?? DEFAULT_CARD_COLORS.secondaryColor,
    textColor: normalizeHexColor(label) ?? DEFAULT_CARD_COLORS.textColor,
  };
}

export async function getPublicProgram(slug: string): Promise<PublicProgram | null> {
  const rows = await getDb().execute(
    sql`SELECT * FROM app_public_program(${slug})`,
  );
  const row = (rows as unknown as Record<string, unknown>[])[0];
  if (!row) return null;
  const colors = pickColors(row.primary_color, row.secondary_color, row.label_color);

  return {
    merchantId: String(row.merchant_id),
    businessName: String(row.business_name),
    logoUrl: (row.logo_url as string | null) ?? null,
    programName: String(row.program_name ?? ""),
    mode: row.mode === "points" ? "points" : "stamps",
    stampsRequired: row.stamps_required == null ? null : Number(row.stamps_required),
    stampIcon: (row.stamp_icon as string | null) ?? null,
    termsText: (row.terms_text as string | null) ?? null,
    ...colors,
  };
}

export async function joinProgram(input: {
  slug: string;
  fullName: string;
  phone: string;
  email?: string;
  consent: boolean;
}): Promise<JoinResult> {
  try {
    const rows = await getDb().execute(sql`
      SELECT out_serial, out_view_token, out_existed, out_balance
      FROM app_join_program(
        ${input.slug}, ${input.fullName}, ${input.phone},
        ${input.email ?? null}, ${input.consent}
      )
    `);
    const row = (rows as unknown as Record<string, unknown>[])[0];
    if (!row) throw new EnrollmentError("no result from join", "invalid");
    return {
      serialNumber: String(row.out_serial),
      webViewToken: String(row.out_view_token),
      alreadyExisted: Boolean(row.out_existed),
      balance: Number(row.out_balance ?? 0),
    };
  } catch (error) {
    throw classify(error);
  }
}

export async function getPassByToken(token: string): Promise<PublicCard | null> {
  if (!token || token.length < 20) return null;
  const rows = await getDb().execute(sql`SELECT * FROM app_pass_by_token(${token})`);
  const row = (rows as unknown as Record<string, unknown>[])[0];
  if (!row) return null;
  const colors = pickColors(row.out_primary_color, row.out_secondary_color, row.out_label_color);

  return {
    firstName: String(row.out_first_name ?? ""),
    balance: Number(row.out_balance ?? 0),
    serialNumber: String(row.out_serial),
    businessName: String(row.out_business_name),
    programName: String(row.out_program_name ?? ""),
    mode: row.out_mode === "points" ? "points" : "stamps",
    stampsRequired: row.out_stamps_required == null ? null : Number(row.out_stamps_required),
    stampIcon: (row.out_stamp_icon as string | null) ?? null,
    logoUrl: (row.out_logo_url as string | null) ?? null,
    ...colors,
  };
}

/**
 * Accepts the phone shapes a Gulf customer actually types and reduces them to
 * digits with an optional leading +. Kept in TypeScript as well as SQL so the
 * user gets the error before a round trip.
 */
export function normalizePhone(input: string): string | null {
  const cleaned = input.trim().replace(/[^0-9+]/g, "");
  const digits = cleaned.replace(/[^0-9]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return cleaned.startsWith("+") ? `+${digits}` : digits;
}
