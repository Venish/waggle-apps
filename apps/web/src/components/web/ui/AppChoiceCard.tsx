"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@repo/ui";
import { AppBadge } from "./AppBadge";
import { AppCheckIndicator } from "./AppCheckControls";

interface AppChoiceCardProps {
  selected: boolean;
  onClick: () => void;
  title: ReactNode;
  description?: ReactNode;
  right?: ReactNode;
  badge?: string;
  showCheck?: boolean;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * 공용 선택형 옵션 카드 (설문·레벨테스트·퀴즈·포인트 충전·상품 옵션 등)
 * - 좌측 공용 커스텀 체크박스(AppCheckIndicator)로 2단계 실습 체크와 100% 통일
 * - 비선택: 무경계 쿨그레이 면(bg-surface-subtle) + 호버 프리뷰
 * - 선택: Waggle Green 소프트 면(bg-brand-soft) + 정밀 그린 링 + 체크 팝/스파클
 */
export function AppChoiceCard({
  selected,
  onClick,
  title,
  description,
  right,
  badge,
  showCheck = true,
  multiple = false,
  disabled = false,
  className,
}: AppChoiceCardProps) {
  const [burstKey, setBurstKey] = useState(0);

  const handleClick = () => {
    if (!selected) {
      setBurstKey((k) => k + 1);
    }
    onClick();
  };

  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={selected}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        "group flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45",
        selected
          ? "bg-brand-soft ring-1.5 ring-brand"
          : "bg-surface-subtle hover:bg-ink/[0.045]",
        className,
      )}
    >
      {showCheck && <AppCheckIndicator checked={selected} burstKey={burstKey} className="mt-0.5" />}

      <div className="min-w-0 flex-1">
        {badge && (
          <AppBadge
            tone={selected ? "brandSolid" : "neutral"}
            className={cn("mb-1", !selected && "bg-surface")}
          >
            {badge}
          </AppBadge>
        )}
        <div
          className={cn(
            "text-sm leading-snug",
            selected ? "font-bold text-ink" : "font-medium text-ink",
          )}
        >
          {title}
        </div>
        {description && (
          <div className="mt-0.5 text-xs leading-relaxed text-ink-muted">{description}</div>
        )}
      </div>

      {right && <div className="shrink-0 self-center">{right}</div>}
    </button>
  );
}

interface AppChipProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: "brand" | "ink";
  disabled?: boolean;
  className?: string;
}

/**
 * 공용 컴팩트 선택 칩 (데일리 스티커·필터·빠른 옵션 선택)
 */
export function AppChip({
  selected,
  onClick,
  children,
  tone = "brand",
  disabled = false,
  className,
}: AppChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
        selected
          ? tone === "ink"
            ? "bg-ink font-semibold text-surface"
            : "bg-brand-soft font-bold text-brand-strong ring-1 ring-brand"
          : "bg-surface-subtle font-medium text-ink-muted hover:bg-ink/[0.05] hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}
