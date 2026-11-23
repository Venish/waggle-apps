"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@repo/ui";

export interface AppSelectOption<T extends string = string> {
  value: T;
  label: string;
}

export interface AppSelectProps<T extends string = string> {
  value: T;
  onChange: (nextValue: T) => void;
  options: readonly AppSelectOption<T>[];
  align?: "left" | "right";
  size?: "sm" | "md";
  ariaLabel?: string;
  className?: string;
}

/**
 * (mobile) 공용 인라인 커스텀 셀렉트 박스 (정렬 · 필터 공용)
 * - 브라우저 기본 <select> 대신 브랜드 톤 팝오버 메뉴 제공
 * - 외부 클릭 · Escape 자동 닫힘 + aria listbox 접근성
 */
export function AppSelect<T extends string = string>({
  value,
  onChange,
  options,
  align = "right",
  size = "sm",
  ariaLabel = "정렬 선택",
  className,
}: AppSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center justify-between gap-1.5 rounded-xl bg-surface-subtle font-semibold text-ink transition-colors hover:bg-ink/[0.06] active:scale-[0.98]",
          size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-3.5 text-sm",
          open && "bg-surface ring-1 ring-ink/15",
        )}
      >
        <span className="whitespace-nowrap">{selected?.label ?? ""}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-ink-muted transition-transform duration-150",
            open && "rotate-180 text-ink",
          )}
          strokeWidth={2.2}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            "animate-modal-pop absolute top-full z-30 mt-1.5 min-w-36 overflow-hidden rounded-2xl bg-surface p-1 shadow-xl ring-1 ring-ink/[0.08]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li key={opt.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs transition-colors",
                    isSelected
                      ? "bg-brand-soft/75 font-bold text-brand-strong"
                      : "font-medium text-ink hover:bg-surface-subtle",
                  )}
                >
                  <span className="whitespace-nowrap">{opt.label}</span>
                  {isSelected && <Check className="size-3.5 shrink-0 text-brand" strokeWidth={2.5} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
