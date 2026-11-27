"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@repo/ui";

export interface AdminSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface AdminSelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: readonly AdminSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  id?: string;
  name?: string;
  className?: string;
  size?: "sm" | "md";
}

interface PopoverRect {
  top: number;
  left: number;
  width: number;
  openUp: boolean;
}

/**
 * ERP Atlas Precision Studio v2.6.0 CustomSelect (외부 패키지 0개 · Server Action <form> 100% 호환)
 * - sm(h-9 36px · rounded-btn-sm) / md(h-10 40px · rounded-control)로 AdminInput과 높이 1:1 정렬
 * - atlas-glass rounded-menu shadow-lg 포털 팝오버 + 자동 상/하 플립 + 키보드 내비게이션
 * - name 지정 시 <input type="hidden"> 자동 렌더링으로 비제어 Server Action <form> 즉시 지원
 */
export function AdminSelect({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = "선택",
  disabled = false,
  invalid = false,
  ariaLabel,
  id,
  name,
  className,
  size = "md",
}: AdminSelectProps) {
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string>(
    defaultValue ?? options[0]?.value ?? "",
  );
  const currentValue = isControlled ? value : uncontrolledValue;

  const [open, setOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const [rect, setRect] = React.useState<PopoverRect | null>(null);

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === currentValue);

  const updatePosition = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const estimatedHeight = Math.min(256, options.length * 34 + 12);
    const spaceBelow = window.innerHeight - box.bottom - 8;
    const openUp = spaceBelow < estimatedHeight && box.top > spaceBelow;
    setRect({
      top: openUp ? box.top - 4 : box.bottom + 4,
      left: box.left,
      width: box.width,
      openUp,
    });
  }, [options.length]);

  const handleOpen = () => {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    updatePosition();
    const idx = options.findIndex((opt) => opt.value === currentValue && !opt.disabled);
    setHighlightedIndex(idx >= 0 ? idx : options.findIndex((opt) => !opt.disabled));
    setOpen(true);
  };

  const handleSelect = (nextValue: string) => {
    if (!isControlled) {
      setUncontrolledValue(nextValue);
    }
    onValueChange?.(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  };

  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        const total = options.length;
        if (total === 0) return;
        setHighlightedIndex((prev) => {
          const base = prev < 0 ? (step > 0 ? -1 : 0) : prev;
          for (let i = 1; i <= total; i += 1) {
            const candidate = (base + step * i + total) % total;
            if (options[candidate] && !options[candidate].disabled) {
              return candidate;
            }
          }
          return prev;
        });
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const targetOpt = options[highlightedIndex];
        if (targetOpt && !targetOpt.disabled) {
          handleSelect(targetOpt.value);
        }
      }
    };

    const handleScrollOrResize = () => updatePosition();

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [open, options, highlightedIndex, updatePosition]);

  return (
    <>
      {name ? <input type="hidden" name={name} value={currentValue} /> : null}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleOpen();
          }
        }}
        className={cn(
          "inline-flex w-full cursor-pointer select-none items-center justify-between gap-2 bg-base-1 text-left text-neutral atlas-border atlas-focus-ring disabled:cursor-not-allowed disabled:opacity-45",
          size === "sm"
            ? "h-9 ps-2.5 pe-2 text-xs rounded-btn-sm"
            : "h-10 ps-3 pe-2.5 text-sm font-normal rounded-control",
          invalid && "atlas-focus-ring-invalid",
          className,
        )}
      >
        <span className={cn("min-w-0 truncate", !selectedOption && "text-subdued")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "shrink-0 text-secondary stroke-[1.75] transition-transform duration-150",
            size === "sm" ? "size-3.5" : "size-4",
            open && "rotate-180 text-neutral",
          )}
          aria-hidden="true"
        />
      </button>

      {open && rect && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-label={ariaLabel}
              style={{
                position: "fixed",
                top: rect.top,
                left: rect.left,
                minWidth: rect.width,
                transform: rect.openUp ? "translateY(-100%)" : undefined,
              }}
              className="z-50 max-h-64 overflow-hidden rounded-menu atlas-glass p-1 text-neutral shadow-lg"
            >
              <div className="max-h-60 overflow-y-auto">
                {options.map((option, idx) => {
                  const isChecked = option.value === currentValue;
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isChecked}
                      disabled={option.disabled}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => handleSelect(option.value)}
                      className={cn(
                        "relative flex w-full cursor-pointer select-none items-center justify-between gap-2 rounded-btn-sm py-1.5 ps-2.5 pe-7 text-left text-control text-neutral outline-none disabled:pointer-events-none disabled:opacity-45",
                        isHighlighted && "bg-[var(--mix-hover-subtle)]",
                        isChecked && "font-[450]",
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      {isChecked ? (
                        <span className="absolute right-2 inline-flex items-center justify-center text-neutral">
                          <Check className="size-3.5 stroke-[2]" aria-hidden="true" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
