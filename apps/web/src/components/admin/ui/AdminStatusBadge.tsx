import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@repo/ui";

export type AdminStatusTone = "positive" | "warning" | "info" | "negative" | "neutral";

export interface AdminStatusBadgeProps {
  tone: AdminStatusTone;
  label?: string;
  children?: ReactNode;
  icon?: LucideIcon;
  size?: "sm" | "md";
  className?: string;
}

const TONE_CLASSES: Record<AdminStatusTone, string> = {
  positive: "bg-[color-mix(in_oklab,var(--text-positive)_12%,transparent)] text-positive",
  warning: "bg-[color-mix(in_oklab,var(--text-warning)_13%,transparent)] text-warning",
  info: "bg-[color-mix(in_oklab,var(--text-info)_12%,transparent)] text-info",
  negative: "bg-[color-mix(in_oklab,var(--text-negative)_13%,transparent)] text-negative",
  neutral: "bg-base-2 text-secondary",
};

const SIZE_CLASSES: Record<"sm" | "md", string> = {
  sm: "h-[1.125rem] px-1.5 gap-1 text-badge",
  md: "h-5 px-2 gap-1 text-xs",
};

/**
 * ERP Atlas Precision Studio v2.6.0 상태 배지 (Server Component 호환)
 * - rounded-badge(6px · superellipse(1.3)) + color-mix 5톤
 */
export function AdminStatusBadge({
  tone,
  label,
  children,
  icon: Icon,
  size = "md",
  className,
}: AdminStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-badge font-medium leading-none tabular-nums",
        SIZE_CLASSES[size],
        TONE_CLASSES[tone],
        className,
      )}
    >
      {Icon ? <Icon className="size-3 shrink-0 stroke-[1.75]" aria-hidden="true" /> : null}
      <span>{label ?? children}</span>
    </span>
  );
}
