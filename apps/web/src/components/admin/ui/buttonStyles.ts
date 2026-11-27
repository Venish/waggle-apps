import { cn } from "@repo/ui";

export type AdminButtonVariant = "solid" | "tint" | "outline" | "ghost" | "danger";
export type AdminButtonSize = "sm" | "md" | "lg" | "icon-sm" | "icon";
export type AdminButtonShape = "default" | "circle";

const VARIANT_CLASSES: Record<AdminButtonVariant, string> = {
  solid: "bg-inverse text-on-inverse hover:opacity-90 active:opacity-85",
  tint: "bg-[var(--mix-tint)] text-neutral hover:bg-[var(--mix-tint-hover)]",
  outline:
    "atlas-border bg-base-1 text-neutral hover:bg-[var(--mix-hover-subtle)] active:bg-[var(--mix-active-subtle)]",
  ghost:
    "bg-transparent text-secondary hover:text-neutral hover:bg-[var(--mix-hover-subtle)] active:bg-[var(--mix-active-subtle)]",
  danger:
    "border border-negative/45 bg-transparent text-negative hover:bg-[var(--mix-hover-subtle)]",
};

const SIZE_CLASSES: Record<AdminButtonSize, string> = {
  sm: "h-8 px-3 gap-1 text-xs rounded-nav-item",
  md: "h-9 px-3.5 gap-1.5 text-control font-medium rounded-panel",
  lg: "h-10 px-4 gap-1.5 text-sm font-medium rounded-btn-lg",
  "icon-sm": "size-7 p-0 rounded-btn-sm",
  icon: "size-8 p-0 rounded-nav-item",
};

/**
 * ERP Atlas Precision Studio v2.6.0 버튼 스타일 SSOT (Server Component <Link> 공용)
 * - 3단 스퀘어클 라운드: sm(14px) · md(16px) · lg(18px) / icon-sm(10px) · icon(14px)
 */
export function adminButtonClass({
  variant = "outline",
  size = "md",
  shape = "default",
  className,
}: {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  shape?: AdminButtonShape;
  className?: string;
} = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-colors duration-150 select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-45",
    SIZE_CLASSES[size],
    shape === "circle" && "rounded-full",
    VARIANT_CLASSES[variant],
    className,
  );
}
