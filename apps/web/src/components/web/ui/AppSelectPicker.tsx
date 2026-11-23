"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@repo/ui";
import { AppCenterModal } from "./AppCenterModal";
import { renderFieldLabel } from "./AppField";

export interface SelectOption {
  value: string;
  label: string;
  sub?: string;
}

interface AppSelectPickerProps {
  label?: string;
  description?: string;
  modalTitle?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
}

/**
 * Toss Underline 트리거 + 화면 정중앙 검색/선택 모달 (<select> 완전 대체)
 */
export function AppSelectPicker({
  label,
  description,
  modalTitle,
  value,
  onChange,
  options,
  placeholder = "선택해 주세요",
  searchable = false,
  searchPlaceholder = "검색어 입력...",
  className,
}: AppSelectPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sub ?? "").toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <div className={cn("group/field w-full", className)}>
      {label && (
        <p
          className={cn(
            "text-xs font-semibold transition-colors duration-200",
            open ? "text-brand-strong" : "text-ink group-focus-within/field:text-brand-strong",
          )}
        >
          {renderFieldLabel(label)}
        </p>
      )}
      <div className="relative mt-1 border-b border-border-subtle">
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setOpen(true);
          }}
          className="flex h-11 w-full items-center justify-between gap-2 text-left transition-opacity active:opacity-70"
        >
          <span
            className={cn(
              "truncate text-base",
              selected ? "font-medium text-ink" : "text-ink-muted/65",
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-ink-muted transition-transform duration-200",
              open && "rotate-180 text-brand-strong",
            )}
            strokeWidth={2}
          />
        </button>
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 -bottom-px h-0.5 origin-left bg-brand transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]",
            open ? "scale-x-100" : "scale-x-0 group-focus-within/field:scale-x-100",
          )}
        />
      </div>
      {description && (
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{description}</p>
      )}

      <AppCenterModal
        open={open}
        onClose={() => setOpen(false)}
        title={modalTitle ?? label ?? "항목 선택"}
        modalId={`select-${label ?? "picker"}`}
      >
        {searchable && (
          <div className="sticky top-0 z-10 border-b border-border-subtle bg-surface px-4 py-2.5">
            <div className="flex items-center gap-2 rounded-xl bg-surface-subtle px-3">
              <Search className="size-4 shrink-0 text-ink-muted" strokeWidth={2} />
              <input
                type="text"
                data-toss-underline="true"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 w-full bg-transparent text-sm text-ink placeholder:text-ink-muted/70"
              />
            </div>
          </div>
        )}

        <ul
          className={cn(
            "space-y-0.5 overflow-y-auto px-3 py-2",
            searchable ? "h-72" : "max-h-72",
          )}
        >
          {filtered.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors active:scale-[0.99]",
                    isSelected ? "bg-brand-soft/65" : "hover:bg-surface-subtle",
                  )}
                >
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate text-sm",
                        isSelected ? "font-bold text-brand-strong" : "font-medium text-ink",
                      )}
                    >
                      {opt.label}
                    </p>
                    {opt.sub && <p className="mt-0.5 text-xs text-ink-muted">{opt.sub}</p>}
                  </div>
                  {isSelected && (
                    <Check className="size-4 shrink-0 text-brand" strokeWidth={2.5} />
                  )}
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="flex h-full items-center justify-center text-sm text-ink-muted">
              검색 결과가 없습니다.
            </li>
          )}
        </ul>

        <div className="flex justify-end border-t border-border-subtle px-4 py-2.5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-9 rounded-lg px-3.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
          >
            취소
          </button>
        </div>
      </AppCenterModal>
    </div>
  );
}
