"use client";

import { useState } from "react";

import { SubmitButton } from "../../_components/submit-button";
import { StampIcon, WalletCardPreview } from "../../_components/wallet-card-preview";
import { STAMP_ICONS } from "@/palette";
import { saveProgram } from "./actions";

/** Step 3 — program name, type (stamp/points) and the earning rule (§3.A 9-10, §5). */
export function ProgramForm({
  businessName,
  initial,
}: {
  businessName: string;
  initial: {
    name: string;
    mode: "points" | "stamps";
    stampsRequired: number | null;
    stampIcon: string | null;
    pointsPerUnit: number | null;
    termsText: string | null;
    primaryColor: string;
    secondaryColor: string;
    textColor: string;
    logoUrl: string | null;
  };
}) {
  const [name, setName] = useState(initial.name);
  const [mode, setMode] = useState<"points" | "stamps">(initial.mode);
  const [stampsRequired, setStamps] = useState(initial.stampsRequired ?? 8);
  const [stampIcon, setIcon] = useState(initial.stampIcon ?? "coffee");
  const [pointsPerUnit, setPointsPerUnit] = useState(initial.pointsPerUnit ?? 10);
  const [description, setDescription] = useState(initial.termsText ?? "");

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form action={saveProgram} className="flex flex-col gap-6">
        <label className="flex flex-col gap-2">
          <span className="text-note font-medium">اسم البرنامج</span>
          <input
            name="name"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: نادي ريفانو"
            className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy outline-none focus-visible:border-teal"
          />
        </label>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-note font-medium">نوع نظام الولاء</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { value: "stamps", title: "بالأختام", hint: "ختم مقابل كل زيارة أو عملية مؤهلة" },
                { value: "points", title: "بالنقاط", hint: "نقاط وفق قاعدة محددة" },
              ] as const
            ).map((o) => (
              <label
                key={o.value}
                className={
                  "flex cursor-pointer flex-col gap-1 rounded-card border px-4 py-3 " +
                  (mode === o.value ? "border-teal bg-mint" : "border-navy/20 bg-warm-white")
                }
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="mode"
                    value={o.value}
                    checked={mode === o.value}
                    onChange={() => setMode(o.value)}
                  />
                  {o.title}
                </span>
                <span className="text-note text-slate">{o.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {mode === "stamps" ? (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-note font-medium">عدد الأختام حتى المكافأة</span>
              <input
                type="number"
                name="stampsRequired"
                min={2}
                max={24}
                value={stampsRequired}
                onChange={(e) => setStamps(Number(e.target.value))}
                className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy"
              />
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-note font-medium">أيقونة الختم</span>
              <div className="flex flex-wrap gap-2">
                {STAMP_ICONS.map((ic) => (
                  <label
                    key={ic.key}
                    title={ic.label}
                    className={
                      "flex h-11 w-11 cursor-pointer items-center justify-center rounded-card border text-section " +
                      (stampIcon === ic.key ? "border-teal bg-mint" : "border-navy/20 bg-warm-white")
                    }
                  >
                    <input
                      type="radio"
                      name="stampIcon"
                      value={ic.key}
                      checked={stampIcon === ic.key}
                      onChange={() => setIcon(ic.key)}
                      className="sr-only"
                    />
                    <StampIcon iconKey={ic.key} className="h-5 w-5" />
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <label className="flex flex-col gap-2">
            <span className="text-note font-medium">النقاط لكل وحدة نقدية</span>
            <input
              type="number"
              name="pointsPerUnit"
              min={1}
              max={1000}
              value={pointsPerUnit}
              onChange={(e) => setPointsPerUnit(Number(e.target.value))}
              className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy"
            />
            <span className="text-note text-slate">
              مثال: ١٠ نقاط لكل ١ د.ب من قيمة الفاتورة.
            </span>
          </label>
        )}

        <label className="flex flex-col gap-2">
          <span className="text-note font-medium">وصف مختصر (اختياري)</span>
          <textarea
            name="description"
            rows={2}
            maxLength={140}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-card border border-navy/20 bg-warm-white px-4 py-3 text-navy"
          />
        </label>

        <SubmitButton label="متابعة" />
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="text-section">معاينة حية</h2>
        <WalletCardPreview
          businessName={businessName}
          programName={name || "برنامج الولاء"}
          description={description || null}
          logoUrl={initial.logoUrl}
          primaryColor={initial.primaryColor}
          secondaryColor={initial.secondaryColor}
          textColor={initial.textColor}
          mode={mode}
          stampsRequired={stampsRequired}
          stampIcon={stampIcon}
        />
        <p className="text-note text-slate">
          معاينة تقريبية — عرض المحافظ النهائي يتحكم ببعض عناصره.
        </p>
      </div>
    </div>
  );
}
