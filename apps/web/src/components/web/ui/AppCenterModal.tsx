"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@repo/ui";
import { useModalHistory } from "@/02_hooks/useModalHistory";

interface AppCenterModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  modalId?: string;
  maxWidthClassName?: string;
  hideHeader?: boolean;
  children: ReactNode;
}

/**
 * 공용 화면 정중앙 플로팅 모달 쉘 (z-50)
 * - createPortal(..., document.body)로 시트(z-40) 위 · Alert(z-60) 아래 고정
 * - useModalHistory 단일 LIFO 매니저로 뒤로가기·ESC·스크롤 잠금을 일원화한다.
 */
export function AppCenterModal({
  open,
  onClose,
  title,
  modalId = "center-modal",
  maxWidthClassName = "max-w-[22.5rem]",
  hideHeader = false,
  children,
}: AppCenterModalProps) {
  useModalHistory({
    isOpen: open,
    onClose,
    modalId,
    closeOnEscape: true,
    lockScroll: true,
  });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "선택 창"}
    >
      {/* Backdrop */}
      <div
        className="animate-fade-in fixed inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered Card */}
      <div
        className={cn(
          "animate-modal-pop relative z-10 flex max-h-[84dvh] w-full flex-col overflow-hidden rounded-3xl bg-surface shadow-2xl ring-1 ring-ink/6",
          maxWidthClassName,
        )}
      >
        {!hideHeader && title && (
          <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-5 py-3.5">
            <h2 className="text-base font-bold tracking-tight text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink/80 transition-[background-color,transform,color] duration-150 hover:bg-ink/[0.11] hover:text-ink active:scale-[0.94]"
            >
              <X className="size-5.5" strokeWidth={1.6} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
