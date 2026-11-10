/**
 * Wallet card preview — BUILD-PROMPT §11.E: a live preview that updates while
 * the merchant changes the logo, colours, texts, program type and stamps.
 *
 * HONESTY REQUIREMENT (also from §11.E): "لا تدّعِ أن المعاينة تطابق العرض
 * النهائي بنسبة 100%" — Apple and Google control parts of the final rendering.
 * The preview is labelled as an approximation wherever it is shown.
 */

import { STAMP_ICON_COMPONENTS } from "./icons";

export interface CardPreviewProps {
  businessName: string;
  programName: string;
  description?: string | null;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  mode: "points" | "stamps";
  stampsRequired?: number | null;
  stampIcon?: string | null;
  /** How many stamps/points to draw as filled, for the preview. */
  sampleBalance?: number;
}

/** Stamp glyphs are SVG (never emoji) so a pass looks identical everywhere. */
export function StampIcon({ iconKey, className }: { iconKey?: string | null; className?: string }) {
  const Icon = STAMP_ICON_COMPONENTS[iconKey ?? "coffee"] ?? STAMP_ICON_COMPONENTS.coffee!;
  return <Icon className={className} aria-hidden strokeWidth={2} />;
}

export function WalletCardPreview({
  businessName,
  programName,
  description,
  logoUrl,
  primaryColor,
  secondaryColor,
  textColor,
  mode,
  stampsRequired,
  stampIcon,
  sampleBalance = 3,
}: CardPreviewProps) {
  const total = Math.max(1, Math.min(stampsRequired ?? 8, 12));

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex w-full flex-col gap-4 rounded-container p-5 shadow-sm"
        style={{ backgroundColor: primaryColor, color: textColor }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-9 w-9 rounded-card object-contain"
                style={{ backgroundColor: secondaryColor }}
              />
            ) : (
              <div
                className="flex h-9 w-9 items-center justify-center rounded-card text-note font-medium"
                style={{ backgroundColor: secondaryColor, color: primaryColor }}
              >
                {businessName.slice(0, 1) || "T"}
              </div>
            )}
            <div className="leading-tight">
              <p className="text-note font-medium">{businessName || "اسم النشاط"}</p>
              <p className="text-note opacity-70">{programName || "برنامج الولاء"}</p>
            </div>
          </div>
          <span className="text-note opacity-70">بطاقة ولاء</span>
        </div>

        {description && <p className="text-note opacity-80">{description}</p>}

        <div className="flex flex-col gap-2">
          {mode === "stamps" ? (
            <div className="flex flex-wrap gap-1 text-section" aria-label="الأختام">
              {Array.from({ length: total }).map((_, i) => (
                <span
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-note"
                  style={
                    i < sampleBalance
                      ? { backgroundColor: secondaryColor, color: primaryColor }
                      : { border: `2px dashed ${secondaryColor}`, opacity: 0.55 }
                  }
                >
                  {i < sampleBalance ? <StampIcon iconKey={stampIcon} className="h-4 w-4" /> : null}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-page-title leading-none">
              {sampleBalance * 10}
              <span className="ms-2 text-note opacity-70">نقطة</span>
            </p>
          )}
          <p className="text-note opacity-70">
            {mode === "stamps"
              ? `متبقٍ ${Math.max(0, total - sampleBalance)} من ${total} حتى المكافأة`
              : "النقاط تُحتسب حسب قاعدة البرنامج"}
          </p>
        </div>

        <div
          className="h-10 w-10 self-end rounded"
          style={{ backgroundColor: textColor, opacity: 0.85 }}
          aria-label="رمز QR"
        />
      </div>
    </div>
  );
}
