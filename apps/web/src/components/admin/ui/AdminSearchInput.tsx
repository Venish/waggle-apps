"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@repo/ui";
import { AdminInput } from "./AdminInput";

export type AdminSearchSizeVariant = "compact" | "standard" | "hero";

export interface AdminSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  debounceMs?: number;
  sizeVariant?: AdminSearchSizeVariant;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

const WIDTH_CLASSES: Record<AdminSearchSizeVariant, string> = {
  compact: "w-full max-w-xs",
  standard: "w-full max-w-xs sm:max-w-sm",
  hero: "w-full max-w-xl",
};

/**
 * ERP Atlas Precision Studio v2.6.0 SearchInput (검색 아이콘 + 커스텀 클리어 X 버튼)
 */
export function AdminSearchInput({
  value,
  onChange,
  onSearch,
  debounceMs = 0,
  sizeVariant = "standard",
  placeholder = "검색어 입력",
  disabled = false,
  ariaLabel = "검색",
  className,
}: AdminSearchInputProps) {
  const [localValue, setLocalValue] = React.useState(value);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const emitChange = (next: string) => {
    setLocalValue(next);
    if (debounceMs > 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange(next), debounceMs);
    } else {
      onChange(next);
    }
  };

  const handleClear = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLocalValue("");
    onChange("");
    onSearch?.("");
  };

  return (
    <div className={cn(WIDTH_CLASSES[sizeVariant], className)}>
      <AdminInput
        type="search"
        size="sm"
        value={localValue}
        onChange={(e) => emitChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSearch?.(localValue);
          } else if (e.key === "Escape" && localValue) {
            e.preventDefault();
            handleClear();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        containerClassName={sizeVariant === "hero" ? "h-9 px-3" : undefined}
        leftSlot={<Search className="size-3.5 stroke-[1.5]" aria-hidden="true" />}
        rightSlot={
          localValue ? (
            <button
              type="button"
              aria-label="검색어 초기화"
              onClick={handleClear}
              className="inline-flex cursor-pointer items-center justify-center rounded-sm text-subdued hover:text-neutral"
            >
              <X className="size-3.5 stroke-[1.5]" aria-hidden="true" />
            </button>
          ) : undefined
        }
      />
    </div>
  );
}
