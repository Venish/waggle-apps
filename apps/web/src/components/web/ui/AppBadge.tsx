import type { ReactNode } from "react";
import { cn } from "@repo/ui";

export type AppBadgeTone = "brand" | "brandSolid" | "neutral" | "ink" | "danger";
export type AppBadgeSize = "sm" | "md";

const TONE_CLASSES: Record<AppBadgeTone, string> = {
  brand: "bg-brand-soft text-brand-strong",
  brandSolid: "bg-brand text-surface",
  neutral: "bg-surface-subtle text-ink-muted",
  ink: "bg-surface-subtle text-ink",
  danger: "bg-destructive/10 text-destructive",
};

const SIZE_CLASSES: Record<AppBadgeSize, string> = {
  sm: "px-2 py-0.5 text-2xs",
  md: "px-2.5 py-1 text-xs",
};

interface AppBadgeProps {
  tone?: AppBadgeTone;
  size?: AppBadgeSize;
  className?: string;
  children: ReactNode;
}

/**
 * 전 화면 공용 모던 사각 배지 (rounded-lg 통일, Server Component 호환)
 */
export function AppBadge({
  tone = "brand",
  size = "sm",
  className,
  children,
}: AppBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg font-bold leading-none whitespace-nowrap",
        SIZE_CLASSES[size],
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
