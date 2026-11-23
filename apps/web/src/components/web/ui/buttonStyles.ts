import { cn } from "@repo/ui";

export type AppButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "dangerSolid";

export type AppButtonSize = "xs" | "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<AppButtonVariant, string> = {
  primary: "bg-brand text-surface font-bold hover:opacity-95",
  secondary: "bg-surface-subtle text-ink hover:bg-ink/[0.06]",
  outline: "border border-border-subtle bg-surface text-ink hover:bg-surface-subtle",
  ghost: "bg-transparent text-ink-muted hover:text-ink",
  danger: "bg-surface-subtle text-destructive hover:bg-destructive/10",
  dangerSolid: "bg-destructive text-surface hover:opacity-95",
};

const SIZE_CLASSES: Record<AppButtonSize, string> = {
  xs: "h-8 px-2.5 text-xs rounded-xl",
  sm: "h-9 px-3 text-xs rounded-xl",
  md: "h-11 px-4 text-sm rounded-2xl",
  lg: "h-12 px-5 text-body-md rounded-2xl",
};

/**
 * <button>(AppButton)과 <Link>(AppLinkButton)가 공유하는 단일 버튼 스타일 SSOT
 * - SIZE_CLASSES를 VARIANT_CLASSES보다 먼저 배치해 tailwind-merge의 커스텀 font-size 충돌 방지
 */
export function appButtonClass({
  variant = "primary",
  size = "lg",
  fullWidth = false,
  className,
}: {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  fullWidth?: boolean;
  className?: string;
}) {
  return cn(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-[transform,opacity,background-color,color] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    fullWidth && "w-full",
    className,
  );
}
