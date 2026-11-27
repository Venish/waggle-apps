"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  adminButtonClass,
  type AdminButtonShape,
  type AdminButtonSize,
  type AdminButtonVariant,
} from "./buttonStyles";

export interface AdminButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  shape?: AdminButtonShape;
  loading?: boolean;
  allowRapidClick?: boolean;
}

const DOUBLE_CLICK_COOLDOWN_MS = 350;

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/**
 * ERP Atlas Precision Studio v2.6.0 버튼 프리미티브 (외부 의존성 0개)
 * - 3단 스퀘어클 라운드 + 350ms 더블클릭 자동 방지 + loading 스피너
 */
export const AdminButton = React.forwardRef<HTMLButtonElement, AdminButtonProps>(
  function AdminButton(
    {
      className,
      variant = "outline",
      size = "md",
      shape = "default",
      loading = false,
      allowRapidClick = false,
      disabled,
      type = "button",
      onClick,
      children,
      ...props
    },
    ref,
  ) {
    const isDisabled = Boolean(disabled || loading);
    const clickLockRef = React.useRef(false);
    const cooldownTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => {
      return () => {
        if (cooldownTimerRef.current !== null) {
          clearTimeout(cooldownTimerRef.current);
          cooldownTimerRef.current = null;
        }
      };
    }, []);

    const scheduleUnlock = React.useCallback(() => {
      if (cooldownTimerRef.current !== null) {
        clearTimeout(cooldownTimerRef.current);
      }
      cooldownTimerRef.current = setTimeout(() => {
        clickLockRef.current = false;
        cooldownTimerRef.current = null;
      }, DOUBLE_CLICK_COOLDOWN_MS);
    }, []);

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      if (isDisabled) {
        event.preventDefault();
        return;
      }

      if (!allowRapidClick && type !== "submit") {
        if (clickLockRef.current) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        clickLockRef.current = true;
        if (!onClick) {
          scheduleUnlock();
          return;
        }
        try {
          const result: unknown = onClick(event);
          if (isThenable(result)) {
            Promise.resolve(result).finally(scheduleUnlock);
          } else {
            scheduleUnlock();
          }
        } catch (err) {
          scheduleUnlock();
          throw err;
        }
        return;
      }

      onClick?.(event);
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        onClick={handleClick}
        className={adminButtonClass({ variant, size, shape, className })}
        {...props}
      >
        {loading ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
        ) : null}
        {children}
      </button>
    );
  },
);
