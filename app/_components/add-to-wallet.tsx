"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, QrCode, TriangleAlert, Wallet } from "lucide-react";

/**
 * "Add the card to the phone's wallet" step, shared by the join confirmation
 * (/j/[slug]/done) and the card page (/c/[token]).
 *
 * WHY THIS IS A CLIENT COMPONENT: the correct wallet depends on the device, and
 * device detection only exists in the browser. Server-rendering both options and
 * hiding one with CSS cannot work — there is no reliable CSS media query for
 * "this is an iPhone".
 *
 * WHY THE BUTTONS ARE REAL LINKS, NOT SCRIPT CALLS: iOS opens a .pkpass when
 * Safari navigates to a URL served with the pass MIME type. Fetching it with
 * JavaScript and then assigning window.location is a well-known way to get a
 * blank tab instead of the Add to Wallet sheet, so the pass is issued first and
 * the buttons are then ordinary anchors.
 *
 * WHY NO APPLE/GOOGLE BADGE ARTWORK: both vendors require their official badge
 * images, and shipping a redrawn or modified badge violates those guidelines.
 * The official assets are not in this repository, so the action is presented in
 * taployal's own words and colours instead of imitating a vendor badge. The
 * function is identical either way; only the button art would change.
 */

interface WalletStateDto {
  configured: boolean;
  issued: boolean;
  hasApple: boolean;
  googleUrl: string | null;
  shareUrl: string | null;
  provider: string | null;
  error: string | null;
  appleUrl: string | null;
}

type Device = "ios" | "android" | "other";
type Phase = "loading" | "issuing" | "ready" | "unavailable" | "error";

function detectDevice(userAgent: string, touchPoints: number): Device {
  if (/iPhone|iPod/i.test(userAgent)) return "ios";
  if (/iPad/i.test(userAgent)) return "ios";
  // iPadOS 13+ reports itself as a Mac; the touch count is what gives it away.
  if (/Macintosh/i.test(userAgent) && touchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "other";
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <LoaderCircle className={`${className} animate-spin`} aria-hidden strokeWidth={2} />;
}

export function AddToWallet({
  token,
  qrDataUrl,
}: {
  token: string;
  /** Server-generated QR of the card URL; shown on desktop so the phone can scan it. */
  qrDataUrl: string | null;
}) {
  const [device, setDevice] = useState<Device>("other");
  const [phase, setPhase] = useState<Phase>("loading");
  const [state, setState] = useState<WalletStateDto | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const endpoint = `/api/wallet/${encodeURIComponent(token)}`;

  const load = useCallback(async () => {
    setMessage(null);
    setPhase("loading");
    try {
      const current = await fetch(endpoint, { cache: "no-store" });
      const body = (await current.json().catch(() => null)) as
        | (WalletStateDto & { error?: string })
        | null;

      if (!current.ok) {
        setMessage(body?.error ?? null);
        setPhase(current.status === 503 ? "unavailable" : "error");
        return;
      }
      if (!body) {
        setPhase("error");
        return;
      }

      // Issued, or the deployment has no provider key: no reason to POST.
      if (body.issued || !body.configured) {
        setState(body);
        setMessage(body.error);
        setPhase(body.issued ? "ready" : "unavailable");
        return;
      }

      setPhase("issuing");
      const created = await fetch(endpoint, { method: "POST", cache: "no-store" });
      const issued = (await created.json().catch(() => null)) as
        | (WalletStateDto & { error?: string })
        | null;

      if (!created.ok || !issued) {
        setMessage(issued?.error ?? null);
        setPhase(created.status === 503 ? "unavailable" : "error");
        return;
      }

      setState(issued);
      setMessage(issued.error);
      setPhase(issued.issued ? "ready" : "unavailable");
    } catch {
      // Network failure: the browser card still works, so this is never fatal.
      setPhase("error");
    }
  }, [endpoint]);

  useEffect(() => {
    setDevice(detectDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0));
    void load();
  }, [load]);

  const appleHref = `/api/wallet/${encodeURIComponent(token)}/apple`;
  const googleHref = `/api/wallet/${encodeURIComponent(token)}/google`;

  const showApple = device !== "android";
  const showGoogle = device !== "ios";

  return (
    <section className="flex flex-col gap-4 rounded-container border border-navy/10 bg-warm-white p-5 text-start">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-teal" aria-hidden strokeWidth={2} />
        <h2 className="text-section">أضف بطاقتك إلى محفظة هاتفك</h2>
      </div>

      {(phase === "loading" || phase === "issuing") && (
        <p className="flex items-center gap-2 text-note text-slate" role="status">
          <Spinner />
          <span>نجهّز بطاقة المحفظة…</span>
        </p>
      )}

      {phase === "ready" && state?.issued && (
        <>
          <p className="text-note text-slate">
            تُحدَّث البطاقة تلقائيًا على هاتفك كلما تغيّر رصيدك.
          </p>
          <div className="flex flex-col gap-3">
            {showApple && (
              <a
                href={appleHref}
                className="flex items-center justify-center gap-2 rounded-pill bg-navy px-6 py-3 font-medium text-warm-white transition-colors hover:bg-midnight"
              >
                <Wallet className="h-5 w-5" aria-hidden strokeWidth={2} />
                أضف إلى Apple Wallet
              </a>
            )}
            {showGoogle && (
              <a
                href={googleHref}
                className="flex items-center justify-center gap-2 rounded-pill border border-navy/20 px-6 py-3 font-medium text-navy transition-colors hover:bg-mint"
              >
                <Wallet className="h-5 w-5" aria-hidden strokeWidth={2} />
                أضف إلى Google Wallet
              </a>
            )}
          </div>

          {device === "other" && qrDataUrl && (
            <div className="flex items-center gap-4 rounded-card border border-navy/10 bg-mint/40 p-4">
              <img src={qrDataUrl} alt="رمز QR لفتح البطاقة على هاتفك" width={112} height={112} className="h-28 w-28 rounded-card bg-warm-white p-2" />
              <p className="flex items-start gap-2 text-note text-slate">
                <QrCode className="mt-0.5 h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
                <span>امسح الرمز بكاميرا هاتفك لتفتح البطاقة وتضيفها إلى محفظته.</span>
              </p>
            </div>
          )}
        </>
      )}

      {phase === "unavailable" && (
        <p className="flex items-start gap-2 text-note text-warning" role="status">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
          <span>
            {message ??
              "إصدار بطاقة المحفظة غير متاح حاليًا على هذا النشر."}{" "}
            بطاقتك تعمل عبر المتصفح في كل الأحوال — احتفظ بالرابط.
          </span>
        </p>
      )}

      {phase === "error" && (
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2 text-note text-error" role="alert">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
            <span>
              {message ?? "تعذّر الوصول إلى مزوّد المحفظة حاليًا."}{" "}
              بطاقتك تعمل عبر المتصفح في هذه الأثناء.
            </span>
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="self-start rounded-pill border border-navy/20 px-5 py-2 text-note font-medium text-navy transition-colors hover:bg-mint"
          >
            إعادة المحاولة
          </button>
        </div>
      )}
    </section>
  );
}
