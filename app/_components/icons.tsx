import {
  ArrowLeft,
  Check,
  Coffee,
  Heart,
  Scissors,
  ShoppingBag,
  Star,
  TriangleAlert,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon set. Emoji are banned as icons by both design rules we follow and they
 * render inconsistently across platforms — and a wallet pass stamp must not be
 * a platform-dependent glyph. Everything here is a Lucide SVG at a consistent
 * stroke weight, per BUILD-PROMPT §11 ("Icons: خطية").
 */

export const STAMP_ICON_COMPONENTS: Record<string, LucideIcon> = {
  coffee: Coffee,
  scissors: Scissors,
  bag: ShoppingBag,
  restaurant: UtensilsCrossed,
  star: Star,
  heart: Heart,
};

export function stampIcon(key?: string | null): LucideIcon {
  return STAMP_ICON_COMPONENTS[key ?? "coffee"] ?? Coffee;
}

/** Status is never colour-only: each carries an icon AND a text label. */
export function ErrorIcon({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return <X className={className} aria-hidden strokeWidth={2} />;
}

export function SuccessIcon({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return <Check className={className} aria-hidden strokeWidth={2} />;
}

export function WarningIcon({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return <TriangleAlert className={className} aria-hidden strokeWidth={2} />;
}

/** Mirrored for RTL: the reference requires directional icons to flip. */
export function BackIcon({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return <ArrowLeft className={`${className} rtl:rotate-180`} aria-hidden strokeWidth={2} />;
}

export function ForwardIcon({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return <ArrowLeft className={`${className} rotate-180 rtl:rotate-0`} aria-hidden strokeWidth={2} />;
}
