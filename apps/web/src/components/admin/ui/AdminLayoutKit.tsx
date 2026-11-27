import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@repo/ui";
import type { AdminStatusTone } from "./AdminStatusBadge";

export function AdminPageHeader({
  title,
  description,
  badge,
  actions,
  className,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-2xl leading-8 font-medium tracking-tight text-neutral break-words">
            {title}
          </h1>
          {badge}
        </div>
        {description ? (
          <p className="mt-1 text-sm text-secondary break-words">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export interface AdminStatItem {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  tone?: AdminStatusTone;
  hidden?: boolean;
}

const STAT_COLUMN_CLASSES: Record<2 | 3 | 4 | 5, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5",
};

const STAT_TONE_CLASSES: Record<AdminStatusTone, string> = {
  neutral: "text-neutral",
  positive: "text-positive",
  warning: "text-warning",
  negative: "text-negative",
  info: "text-info",
};

/**
 * ERP Atlas Precision Studio v2.6.0 MonotoneStatStrip (divided / surface 2모드)
 */
export function AdminStatStrip({
  items,
  columns = 4,
  variant = "divided",
  className,
}: {
  items: readonly AdminStatItem[];
  columns?: 2 | 3 | 4 | 5;
  variant?: "surface" | "divided";
  className?: string;
}) {
  const visibleItems = items.filter((item) => !item.hidden);
  if (visibleItems.length === 0) return null;

  if (variant === "divided") {
    return (
      <div
        className={cn(
          "grid divide-y divide-hairline rounded-panel bg-base-1 atlas-border sm:divide-x sm:divide-y-0",
          STAT_COLUMN_CLASSES[columns],
          className,
        )}
      >
        {visibleItems.map((item) => (
          <div key={item.id} className="flex flex-col gap-1 p-4">
            <span className="text-xs font-medium text-secondary">{item.label}</span>
            <span
              className={cn(
                "font-mono text-xl leading-7 font-medium tracking-tight tabular-nums",
                STAT_TONE_CLASSES[item.tone ?? "neutral"],
              )}
            >
              {item.value}
            </span>
            {item.subValue ? (
              <span className="font-mono text-xs tabular-nums text-subdued">{item.subValue}</span>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-3 rounded-panel bg-base-2 p-4",
        STAT_COLUMN_CLASSES[columns],
        className,
      )}
    >
      {visibleItems.map((item) => (
        <div key={item.id} className="flex flex-col gap-1 px-1">
          <span className="text-xs font-medium text-secondary">{item.label}</span>
          <span
            className={cn(
              "font-mono text-xl leading-7 font-medium tracking-tight tabular-nums",
              STAT_TONE_CLASSES[item.tone ?? "neutral"],
            )}
          >
            {item.value}
          </span>
          {item.subValue ? (
            <span className="font-mono text-xs tabular-nums text-subdued">{item.subValue}</span>
          ) : null}
        </div>
      ))}
    </div>
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
      {sub ? <p className="mt-1 text-xs text-subdued">{sub}</p> : null}
    </div>
  );
}

export function AdminEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-10 text-center",
        className,
      )}
    >
      <Icon className="size-5 text-subdued stroke-[1.5]" aria-hidden="true" />
      <p className="text-sm font-medium text-neutral">{title}</p>
      {description ? <p className="max-w-sm text-xs text-subdued">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
