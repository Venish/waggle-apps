import type { ReactNode } from "react";
import { cn } from "@repo/ui";

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2.5 sm:items-center sm:gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-neutral break-words">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-control text-secondary break-words">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function AdminStatusBadge({
  tone,
  children,
}: {
  tone: "neutral" | "info" | "positive" | "warning" | "negative";
  children: ReactNode;
}) {
  const toneClass: Record<typeof tone, string> = {
    neutral: "bg-[var(--mix-tint)] text-secondary",
    info: "bg-info/15 text-info",
    positive: "bg-positive/15 text-positive",
    warning: "bg-warning/15 text-warning",
    negative: "bg-negative/15 text-negative",
  };
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-badge px-1.5 text-xs font-medium leading-none",
        toneClass[tone],
      )}
    >
      {children}
    </span>
  );
}

export function AdminStatCard({
  label,
  value,
  sub,
  tone = "text-neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-panel bg-base-2 p-4 atlas-border">
      <p className="text-xs font-medium text-secondary">{label}</p>
      <p className={cn("mt-2 font-mono text-2xl font-semibold tabular-nums", tone)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-subdued">{sub}</p>}
    </div>
  );
}
