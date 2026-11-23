"use client";

import { useState } from "react";
import { cn } from "@repo/ui";

interface AppCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
}

// viewBox 40x40 기준 중앙 박스([10, 30]) 바깥에 2px 이상 여백을 두고 짧고 정교하게 뻗는 6개 스파클 라인
const SPARKLE_RAYS = [
  { x1: 8, y1: 8, x2: 5.8, y2: 5.8, delay: "0ms" },
  { x1: 32, y1: 8, x2: 34.2, y2: 5.8, delay: "22ms" },
  { x1: 33, y1: 20, x2: 36, y2: 20, delay: "44ms" },
  { x1: 32, y1: 32, x2: 34.2, y2: 34.2, delay: "66ms" },
  { x1: 8, y1: 32, x2: 5.8, y2: 34.2, delay: "88ms" },
  { x1: 7, y1: 20, x2: 4, y2: 20, delay: "110ms" },
] as const;

/**
 * 공용 커스텀 체크 박스 인디케이터 (AppCheckbox · AppChoiceCard 공통 SSOT)
 * - 비체크: 선명한 테두리 + 화이트 배경
 * - 체크 전환 시(animateNow): 탄성 팝 + SVG 체크 획 그리기 + 6방향 시차 스파클
 */
export function AppCheckIndicator({
  checked,
  burstKey = 0,
  className,
}: {
  checked: boolean;
  burstKey?: number;
  className?: string;
}) {
  const animateNow = checked && burstKey > 0;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex size-5 shrink-0 items-center justify-center overflow-visible",
        className,
      )}
    >
      {/* 6방향 시차 스파클 라인 (클릭으로 체크될 때만 1회 재생) */}
      {animateNow && (
        <svg
          key={burstKey}
          viewBox="0 0 40 40"
          fill="none"
          aria-hidden="true"
          className="pointer-events-none absolute -inset-2.5 size-10 overflow-visible text-brand"
        >
          {SPARKLE_RAYS.map((ray, idx) => (
            <line
              key={idx}
              x1={ray.x1}
              y1={ray.y1}
              x2={ray.x2}
              y2={ray.y2}
              pathLength={1}
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeDasharray="1 2"
              className="animate-sparkle-ray"
              style={{ animationDelay: ray.delay }}
            />
          ))}
        </svg>
      )}

      {/* 박스 본체 + SVG 체크 획 그리기 */}
      <span
        className={cn(
          "relative flex size-5 items-center justify-center rounded-lg border-2 transition-colors duration-150",
          checked
            ? "border-brand bg-brand text-surface"
            : "border-ink/25 bg-surface text-transparent group-hover:border-ink/40",
          animateNow && "animate-check-pop",
        )}
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className="size-3.5"
        >
          <path
            key={animateNow ? burstKey : "static"}
            d="M4.2 10.4L8.1 14.3L15.8 6.2"
            pathLength={1}
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1"
            strokeDashoffset={checked ? 0 : 1}
            className={cn(animateNow && "animate-check-draw")}
          />
        </svg>
      </span>
    </span>
  );
}

/**
 * 타이트 라운드 스퀘어 체크박스 (원형 X, 1곳 수정으로 전 화면 일괄 반영)
 * - 체크 전환 시(false -> true) 박스 탄성 팝 + 체크 SVG 획 그리기 + 6방향 시차 빛남 라인 드로우
 * - 초기 마운트 시 이미 checked=true인 항목에는 이펙트를 재생하지 않음
 */
export function AppCheckbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className,
  labelClassName,
}: AppCheckboxProps) {
  const [burstKey, setBurstKey] = useState(0);

  const handleToggle = () => {
    if (!checked) {
      setBurstKey((k) => k + 1);
    }
    onChange(!checked);
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleToggle}
      className={cn(
        "group flex w-full items-start gap-3 py-2.5 text-left transition-opacity active:opacity-75 disabled:opacity-45",
        className,
      )}
    >
      <AppCheckIndicator checked={checked} burstKey={burstKey} className="mt-0.5" />

      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-medium text-ink", labelClassName)}>{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>}
      </span>
    </button>
  );
}

interface AppSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
}

/**
 * iOS / Toss 스타일 슬라이딩 그린 토글 스위치 (ON/OFF 설정 전용)
 */
export function AppSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className,
  labelClassName,
}: AppSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group flex w-full items-center justify-between gap-4 py-3 text-left transition-opacity active:opacity-80 disabled:opacity-45",
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-medium text-ink", labelClassName)}>{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>}
      </span>
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200",
          checked ? "bg-brand" : "bg-ink/[0.12] group-hover:bg-ink/[0.17]",
        )}
      >
        <span
          className={cn(
            "h-5 w-5 rounded-full bg-surface shadow-xs transition-[transform,width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-active:w-6",
            checked ? "translate-x-5 group-active:translate-x-4" : "translate-x-0",
          )}
        />
      </span>
    </button>
  );
}
