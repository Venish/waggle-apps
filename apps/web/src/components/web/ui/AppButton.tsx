"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  appButtonClass,
  type AppButtonSize,
  type AppButtonVariant,
} from "./buttonStyles";

export type { AppButtonSize, AppButtonVariant };

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  children: ReactNode;
}

/**
 * 모바일 공용 버튼 (<button> 전용, AppLinkButton과 buttonStyles.ts 100% 공유)
 */
export function AppButton({
  variant = "primary",
  size = "lg",
  fullWidth = false,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: AppButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={appButtonClass({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" strokeWidth={2.2} />}
      {children}
    </button>
  );
}
