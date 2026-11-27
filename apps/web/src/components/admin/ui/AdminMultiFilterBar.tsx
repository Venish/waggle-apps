"use client";

import * as React from "react";
import { RotateCcw, X } from "lucide-react";
import { cn } from "@repo/ui";
import { AdminButton } from "./AdminButton";
import { AdminSearchInput } from "./AdminSearchInput";

export interface AdminFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export interface AdminMultiFilterBarProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    onSearch?: (value: string) => void;
    placeholder?: string;
  };
  filters?: React.ReactNode;
  activeChips?: readonly AdminFilterChip[];
  onReset?: () => void;
  rightSlot?: React.ReactNode;
  className?: string;
}

/**
 * ERP Atlas Precision Studio v2.6.0 MultiFilterBar
 */
export function AdminMultiFilterBar({
  search,
  filters,
  activeChips,
  onReset,
  rightSlot,
  className,
}: AdminMultiFilterBarProps) {
  return (
    <section
      aria-label="검색 및 필터"
      className={cn("flex flex-col gap-3 rounded-panel bg-base-2 p-3.5", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          {search ? (
            <AdminSearchInput
              value={search.value}
              onChange={search.onChange}
              onSearch={search.onSearch}
              placeholder={search.placeholder}
            />
          ) : null}
          {filters}
          {onReset ? (
            <AdminButton variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="size-3.5 stroke-[1.5]" aria-hidden="true" />
              <span>초기화</span>
            </AdminButton>
          ) : null}
        </div>
        {rightSlot ? <div className="flex shrink-0 items-center gap-2">{rightSlot}</div> : null}
      </div>

      {activeChips && activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex h-6 items-center gap-1 rounded-badge bg-base-3 px-2 text-xs text-neutral atlas-border"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                aria-label={`${chip.label} 필터 해제`}
                onClick={chip.onRemove}
                className="inline-flex cursor-pointer items-center justify-center text-subdued hover:text-neutral"
              >
                <X className="size-3 stroke-[1.5]" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
