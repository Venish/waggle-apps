"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface ModalShellProps {
  open: boolean;
  onClose?: () => void;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  role?: "dialog" | "alertdialog";
  ariaLabel: string;
  overlayClassName?: string;
  containerClassName?: string;
  children: ReactNode;
}

/**
 * 테마 수치 하드코딩이 없는 접근성/구조 모달 프리미티브.
 * 사용자(web.css)와 관리자(admin.css)가 각자의 토큰 클래스를 주입해 사용한다.
 */
export function ModalShell({
  open,
  onClose,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  role = "dialog",
  ariaLabel,
  overlayClassName,
  containerClassName,
  children,
}: ModalShellProps) {
  useEffect(() => {
    if (!open || !closeOnEscape || !onClose) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  return (
    <div
      role={role}
      aria-modal="true"
      aria-label={ariaLabel}
      className={cn("fixed inset-0 flex items-center justify-center", containerClassName)}
    >
      <div
        aria-hidden="true"
        className={cn("fixed inset-0", overlayClassName)}
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
