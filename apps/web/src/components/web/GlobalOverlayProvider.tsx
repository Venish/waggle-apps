"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@repo/ui";
import { useModalStore } from "@/01_store/web/useModalStore";
import { useModalHistory } from "@/02_hooks/useModalHistory";

/**
 * 1차 전역 오버레이 (z-40, Max Depth = 1)
 * - 뒤 화면이 어둡게 비쳐 보이는 배경 유지 슬라이드업 시트
 * - pathname 변경 시 dismissForNavigation()으로 잔여 시트를 충돌 없이 즉시 정리한다.
 */
export function GlobalOverlayProvider() {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  const stack = useModalStore((s) => s.stack);
  const closeTopModal = useModalStore((s) => s.closeTopModal);
  const dismissForNavigation = useModalStore((s) => s.dismissForNavigation);

  const activeModal = stack[stack.length - 1] ?? null;

  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      dismissForNavigation();
    }
  }, [pathname, dismissForNavigation]);

  const handleClose = useCallback(() => {
    closeTopModal();
  }, [closeTopModal]);

  useModalHistory({
    isOpen: Boolean(activeModal),
    onClose: handleClose,
    modalId: activeModal?.id ?? "global-sheet",
    closeOnEscape: true,
    lockScroll: true,
  });

  if (!activeModal) return null;

  const isSlideUp = activeModal.direction === "slide-up";

  return (
    <div
      key={activeModal.id}
      role="dialog"
      aria-modal="true"
      aria-label={activeModal.title ?? "시트"}
      className="fixed inset-0 z-40 mx-auto flex w-full max-w-app items-end justify-center overflow-hidden"
    >
      {/* 배경 유지 Dim Backdrop */}
      <div
        aria-hidden="true"
        className="animate-fade-in absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
        onClick={handleClose}
      />

      {/* Sheet Panel */}
      <div
        className={cn(
          "relative z-10 flex w-full flex-col overflow-hidden bg-surface shadow-2xl ring-1 ring-ink/6",
          isSlideUp
            ? "animate-sheet-up max-h-[90dvh] rounded-t-3xl"
            : "animate-page-right h-full",
        )}
      >
        {isSlideUp && (
          <div className="flex shrink-0 justify-center pt-2.5 pb-1" aria-hidden="true">
            <span className="h-1 w-9 rounded-full bg-ink/15" />
          </div>
        )}

        {activeModal.title && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold tracking-tight text-ink">
                {activeModal.title}
              </h2>
              {activeModal.subtitle && (
                <p className="mt-0.5 truncate text-xs text-ink-muted">{activeModal.subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="시트 닫기"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink/80 transition-[background-color,transform,color] duration-150 hover:bg-ink/[0.11] hover:text-ink active:scale-[0.94]"
            >
              <X className="size-5.5" strokeWidth={1.6} />
            </button>
          </div>
        )}

        <div
          className={cn(
            "no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pt-4",
            activeModal.stickyFooter ? "pb-0" : "pb-8 pb-safe-bottom",
          )}
        >
          {activeModal.content}
        </div>
      </div>
    </div>
  );
}
