"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { X } from "lucide-react";
import { cn } from "@repo/ui";

export function renderFieldLabel(label: string): ReactNode {
  if (!label.endsWith(" *")) return label;
  return (
    <>
      {label.slice(0, -2)}
      <span
        aria-hidden="true"
        className="ml-1 inline-block size-1.5 -translate-y-0.5 rounded-full bg-brand align-middle"
      />
      <span className="sr-only"> (필수)</span>
    </>
  );
}

export interface AppFieldGroupProps {
  label?: string;
  /** 라벨 우측 보조 메타 (예: "2/5", "장당 15MB 이하", 액션 버튼) */
  labelMeta?: ReactNode;
  /** 입력창 하단 보조 설명 (에러 발생 시 error가 우선 표시됨) */
  description?: string;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

/**
 * 모바일 공용 폼 필드 래퍼 (사진 업로더 · 스티커 · 요일 등 커스텀 입력용 단일 SSOT)
 * - 라벨: text-xs font-semibold text-ink
 * - 보조 설명: 하단 mt-1.5 text-xs leading-relaxed text-ink-muted
 */
export function AppFieldGroup({
  label,
  labelMeta,
  description,
  error,
  htmlFor,
  className,
  children,
}: AppFieldGroupProps) {
  return (
    <div className={cn("w-full", className)}>
      {(label || labelMeta) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {label ? (
            htmlFor ? (
              <label
                htmlFor={htmlFor}
                className={cn(
                  "block text-xs font-semibold",
                  error ? "text-destructive" : "text-ink",
                )}
              >
                {renderFieldLabel(label)}
              </label>
            ) : (
              <p
                className={cn(
                  "text-xs font-semibold",
                  error ? "text-destructive" : "text-ink",
                )}
              >
                {renderFieldLabel(label)}
              </p>
            )
          ) : (
            <span />
          )}
          {labelMeta && (
            <div className="shrink-0 text-xs text-ink-muted">{labelMeta}</div>
          )}
        </div>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>
      ) : (
        description && (
          <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{description}</p>
        )
      )}
    </div>
  );
}

interface AppInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  labelMeta?: ReactNode;
  description?: string;
  suffix?: string;
  error?: string;
  clearable?: boolean;
  onClear?: () => void;
}

/**
 * Toss Underline Input — 4면 박스 제거, 하단 1px 선 + 포커스 시 2px Waggle Green
 * (전 폼 공용 라벨·설명·에러 규격 단일 SSOT)
 */
export const AppInput = forwardRef<HTMLInputElement, AppInputProps>(function AppInput(
  {
    label,
    labelMeta,
    description,
    suffix,
    error,
    clearable,
    onClear,
    id,
    className,
    value,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hasValue = value !== undefined && value !== null && String(value).length > 0;

  return (
    <div className="group/field w-full">
      {(label || labelMeta) && (
        <div className="flex items-center justify-between gap-2">
          {label ? (
            <label
              htmlFor={inputId}
              className={cn(
                "block text-xs font-semibold transition-colors duration-200",
                error
                  ? "text-destructive"
                  : "text-ink group-focus-within/field:text-brand-strong",
              )}
            >
              {renderFieldLabel(label)}
            </label>
          ) : (
            <span />
          )}
          {labelMeta && <div className="shrink-0 text-xs text-ink-muted">{labelMeta}</div>}
        </div>
      )}
      <div className="relative mt-1 flex items-center border-b border-border-subtle">
        <input
          ref={ref}
          id={inputId}
          data-toss-underline="true"
          value={value}
          className={cn(
            "h-11 w-full bg-transparent text-base font-medium text-ink placeholder:font-normal placeholder:text-ink-muted/65",
            (clearable || suffix) && "pr-8",
            className,
          )}
          {...rest}
        />
        {clearable && hasValue && onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="입력 지우기"
            className="absolute right-0 flex size-7 items-center justify-center text-ink-muted transition-opacity hover:text-ink active:opacity-60"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        )}
        {suffix && !clearable && (
          <span className="pointer-events-none shrink-0 pl-2 text-sm font-medium text-ink-muted">
            {suffix}
          </span>
        )}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 -bottom-px h-0.5 origin-left transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]",
            error
              ? "scale-x-100 bg-destructive"
              : "scale-x-0 bg-brand group-focus-within/field:scale-x-100",
          )}
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>
      ) : (
        description && (
          <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{description}</p>
        )
      )}
    </div>
  );
});

interface AppTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  labelMeta?: ReactNode;
  description?: string;
  error?: string;
}

/**
 * 다중행 장문 입력용 Textarea — 화이트 배경 + 얇은 1px 보더
 */
export const AppTextarea = forwardRef<HTMLTextAreaElement, AppTextareaProps>(function AppTextarea(
  { label, labelMeta, description, error, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const textareaId = id ?? autoId;

  return (
    <div className="w-full">
      {(label || labelMeta) && (
        <div className="flex items-center justify-between gap-2">
          {label ? (
            <label
              htmlFor={textareaId}
              className={cn(
                "block text-xs font-semibold",
                error ? "text-destructive" : "text-ink",
              )}
            >
              {renderFieldLabel(label)}
            </label>
          ) : (
            <span />
          )}
          {labelMeta && <div className="shrink-0 text-xs text-ink-muted">{labelMeta}</div>}
        </div>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        className={cn(
          "mt-1.5 w-full rounded-xl border bg-surface p-3.5 text-base leading-relaxed text-ink placeholder:text-ink-muted/65",
          error ? "border-destructive" : "border-border-subtle",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>
      ) : (
        description && (
          <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{description}</p>
        )
      )}
    </div>
  );
});
