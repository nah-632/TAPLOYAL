"use client";

import { useRef, useState } from "react";

import { SubmitButton } from "../../_components/submit-button";
import { WalletCardPreview } from "../../_components/wallet-card-preview";
import { CARD_PRESETS } from "@/palette";
import { saveBranding } from "./actions";

/**
 * Step 2 form — BUILD-PROMPT §11.E: the preview updates while the merchant
 * changes the logo and colours.
 *
 * The logo is downscaled in the browser before upload (max 512px, JPEG/PNG) so
 * the payload stays small. That matters because the current storage driver keeps
 * the image inline (see src/storage/index.ts) — the server enforces the real
 * size limit.
 */
const MAX_EDGE = 512;

async function shrinkToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/png");
}

export function BrandForm({
  businessName,
  programName,
  initial,
}: {
  businessName: string;
  programName: string;
  initial: { primaryColor: string; secondaryColor: string; textColor: string; logoUrl: string | null };
}) {
  const [primaryColor, setPrimary] = useState(initial.primaryColor);
  const [secondaryColor, setSecondary] = useState(initial.secondaryColor);
  const [textColor, setText] = useState(initial.textColor);
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);
  const [logoError, setLogoError] = useState<string | null>(null);
  const hiddenLogo = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form action={saveBranding} className="flex flex-col gap-5">
        <input type="hidden" name="logoDataUrl" ref={hiddenLogo} />

        <div className="flex flex-col gap-2">
          <span className="text-note font-medium">شعار النشاط</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setLogoError(null);
              try {
                const dataUrl = await shrinkToDataUrl(file);
                setLogoUrl(dataUrl);
                if (hiddenLogo.current) hiddenLogo.current.value = dataUrl;
              } catch {
                setLogoError("تعذّر قراءة الصورة. جرّب ملف PNG أو JPEG.");
              }
            }}
            className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-note"
          />
          {logoError && <span className="text-note text-error">{logoError}</span>}
          <span className="text-note text-slate">
            تُصغَّر الصورة في المتصفح قبل الإرسال. يمكنك المتابعة بدون شعار الآن.
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-2">
            <span className="text-note font-medium">اللون الأساسي</span>
            <input
              type="color"
              name="primaryColor"
              value={primaryColor}
              onChange={(e) => setPrimary(e.target.value)}
              className="h-11 w-full rounded-card border border-navy/20"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-note font-medium">اللون الثانوي</span>
            <input
              type="color"
              name="secondaryColor"
              value={secondaryColor}
              onChange={(e) => setSecondary(e.target.value)}
              className="h-11 w-full rounded-card border border-navy/20"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-note font-medium">لون النص</span>
            <input
              type="color"
              name="textColor"
              value={textColor}
              onChange={(e) => setText(e.target.value)}
              className="h-11 w-full rounded-card border border-navy/20"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {CARD_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPrimary(p.primary);
                setSecondary(p.secondary);
                setText(p.text);
              }}
              className="rounded-pill border border-navy/20 px-4 py-2 text-note"
            >
              {p.label}
            </button>
          ))}
        </div>

        <SubmitButton label="متابعة" />
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="text-section">معاينة حية</h2>
        <WalletCardPreview
          businessName={businessName}
          programName={programName}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          textColor={textColor}
          mode="stamps"
          stampsRequired={8}
          stampIcon="coffee"
        />
        <p className="text-note text-slate">
          هذه معاينة تقريبية فقط. عرض Apple Wallet وGoogle Wallet النهائي يتحكم
          ببعض عناصرهما، ولا يمكن مطابقته بنسبة ١٠٠٪.
        </p>
      </div>
    </div>
  );
}
