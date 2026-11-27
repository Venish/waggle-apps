"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@repo/ui";

export interface AdminSegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
}

export interface AdminSegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly AdminSegmentedOption<T>[];
  size?: "sm" | "md";
  ariaLabel?: string;
  className?: string;
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

interface ThumbMetric {
  left: number;
  width: number;
  ready: boolean;
  animated: boolean;
}

/**
 * ERP Atlas Precision Studio v2.6.0 슬라이딩 SegmentedControl
 */
export function AdminSegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  size = "md",
  ariaLabel = "보기 전환",
  className,
}: AdminSegmentedControlProps<T>) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const buttonRefs = React.useRef<Map<T, HTMLButtonElement>>(new Map());
  const hasMeasuredRef = React.useRef(false);
  const [thumb, setThumb] = React.useState<ThumbMetric>({
    left: 0,
    width: 0,
    ready: false,
    animated: false,
  });

  const measureActive = React.useCallback(
    (animate: boolean) => {
      const activeEl = buttonRefs.current.get(value);
      if (!activeEl) return;
      const nextLeft = activeEl.offsetLeft;
      const nextWidth = activeEl.offsetWidth;
      setThumb((prev) => {
        if (
          prev.ready &&
          prev.left === nextLeft &&
          prev.width === nextWidth &&
          prev.animated === animate
        ) {
          return prev;
        }
        return { left: nextLeft, width: nextWidth, ready: true, animated: animate };
      });
    },
    [value],
  );

  useIsomorphicLayoutEffect(() => {
    const shouldAnimate = hasMeasuredRef.current;
    measureActive(shouldAnimate);
    hasMeasuredRef.current = true;
  }, [measureActive, options, size]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measureActive(false));
    observer.observe(container);
    return () => observer.disconnect();
  }, [measureActive]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const total = options.length;
    if (total === 0) return;
    for (let offset = 1; offset <= total; offset += 1) {
      const nextIndex = (currentIndex + step * offset + total) % total;
      const nextOption = options[nextIndex];
      if (nextOption && !nextOption.disabled) {
        onValueChange(nextOption.value);
        break;
      }
    }
  };

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-menu bg-[var(--mix-hover-subtle)] p-0.5",
        className,
      )}
    >
      {thumb.ready ? (
        <span
          aria-hidden="true"
          style={{
            transform: `translateX(${thumb.left}px)`,
            width: `${thumb.width}px`,
          }}
          className={cn(
            "pointer-events-none absolute top-0.5 bottom-0.5 left-0 rounded-menu bg-base-3 shadow-xs atlas-border",
            thumb.animated && "transition-[transform,width] duration-200 ease-out",
          )}
        />
      ) : null}
      {options.map((option, index) => {
        const isActive = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            ref={(el) => {
              if (el) buttonRefs.current.set(option.value, el);
              else buttonRefs.current.delete(option.value);
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "relative z-10 inline-flex cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-menu transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-45",
              size === "sm" ? "h-6 px-2.5 text-xs" : "h-7 px-3 text-control",
              isActive
                ? cn(
                    "font-medium text-neutral",
                    !thumb.ready && "bg-base-3 shadow-xs atlas-border",
                  )
                : "bg-transparent text-secondary hover:text-neutral",
            )}
          >
            {Icon ? <Icon className="size-3.5 stroke-[1.5]" aria-hidden="true" /> : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
