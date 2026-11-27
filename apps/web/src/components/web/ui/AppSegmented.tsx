"use client";

import { cn } from "@repo/ui";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** 탭/세그먼트 라벨 우측에 표시할 선택 카운트 (0이면 pill에서는 숨김, underline에서는 표시) */
  count?: number;
}

interface AppSegmentedProps<T extends string> {
  label?: string;
  description?: string;
  ariaLabel?: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  /** "pill": 둥근 슬라이딩 세그먼트 (기본) | "underline": 하단 인디케이터 페이지 탭 */
  variant?: "pill" | "underline";
  /** 페이지 전환 탭 용도일 때 role="tablist"/"tab" 적용 (underline은 기본 true) */
  asTabs?: boolean;
  className?: string;
}

/**
 * 모바일 공용 세그먼트 · 페이지 탭 컴포넌트 (단일 SSOT · text-sm 14px 통일)
 * - "pill": 2~4지선다 폼 선택 및 상단 세그먼트 탭 (좌우 슬라이딩 thumb)
 * - "underline": 상품 상세 등 하단 보더형 페이지 탭 (좌우 슬라이딩 인디케이터)
 */
export function AppSegmented<T extends string>({
  label,
  description,
  ariaLabel,
  value,
  onChange,
  options,
  variant = "pill",
  asTabs,
  className,
}: AppSegmentedProps<T>) {
  const activeIndex = options.findIndex((o) => o.value === value);
  const useTabRole = asTabs ?? variant === "underline";
  const groupLabel = ariaLabel ?? label;

  if (variant === "underline") {
    return (
      <div
        role={useTabRole ? "tablist" : "radiogroup"}
        aria-label={groupLabel}
        className={cn("relative grid border-y border-border-subtle bg-surface/95 backdrop-blur-md", className)}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role={useTabRole ? "tab" : "radio"}
              aria-selected={useTabRole ? active : undefined}
              aria-checked={!useTabRole ? active : undefined}
              onClick={() => onChange(opt.value)}
              className={cn(
                "relative flex items-center justify-center gap-1.5 py-3 text-sm text-ink transition-colors",
                active ? "font-bold" : "font-normal hover:opacity-80",
              )}
            >
              <span>{opt.label}</span>
              {opt.count !== undefined && (
                <span className="tabular-nums font-extrabold text-brand-strong">
                  {opt.count}
                </span>
              )}
            </button>
          );
        })}

        {activeIndex >= 0 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-0 px-4 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              width: `${100 / options.length}%`,
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          >
            <span className="block h-0.5 w-full rounded-full bg-ink" />
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {label && <p className="mb-1.5 text-xs font-semibold text-ink">{label}</p>}
      <div className="rounded-3xl bg-ink/[0.07] p-1 dark:bg-white/[0.06]">
        <div
          role={useTabRole ? "tablist" : "radiogroup"}
          aria-label={groupLabel}
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        >
          {activeIndex >= 0 && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                width: `${100 / options.length}%`,
                transform: `translateX(${activeIndex * 100}%)`,
              }}
            >
              <span className="block h-full w-full rounded-2xl bg-surface shadow-sm ring-1 ring-ink/[0.06] dark:bg-white/[0.14] dark:ring-white/[0.1]" />
            </span>
          )}
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role={useTabRole ? "tab" : "radio"}
                aria-selected={useTabRole ? active : undefined}
                aria-checked={!useTabRole ? active : undefined}
                onClick={() => onChange(opt.value)}
                className={cn(
                  "relative z-10 flex h-10 w-full items-center justify-center gap-1 rounded-2xl text-sm transition-colors duration-200 active:scale-[0.96]",
                  active
                    ? "font-bold text-ink"
                    : "font-medium text-ink-muted hover:text-ink",
                )}
              >
                <span>{opt.label}</span>
                {opt.count !== undefined && opt.count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-xs font-bold leading-none tabular-nums",
                      active
                        ? "bg-brand-soft text-brand-strong"
                        : "bg-ink/[0.08] text-ink-muted",
                    )}
                  >
                    {opt.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {description && (
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{description}</p>
      )}
    </div>
  );
}
