"use client";

import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { ModalShell } from "@repo/ui";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { useModalHistory } from "@/02_hooks/useModalHistory";
import { AppButton } from "@/components/web/ui";

export function WebGlobalAlert() {
  const isOpen = useWebAlertStore((s) => s.isOpen);
  const payload = useWebAlertStore((s) => s.payload);
  const closeAlert = useWebAlertStore((s) => s.closeAlert);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [isOpen, payload]);

  useModalHistory({
    isOpen: Boolean(isOpen && payload),
    onClose: closeAlert,
    modalId: "web-global-alert",
    closeOnEscape: false,
    lockScroll: true,
  });

  if (!isOpen || !payload) return null;

  const isDestructive = payload.tone === "destructive";

  return (
    <ModalShell
      open={isOpen}
      onClose={closeAlert}
      closeOnOverlayClick={false}
      closeOnEscape={false}
      role="alertdialog"
      ariaLabel={payload.title}
      containerClassName="z-60 p-4"
      overlayClassName="animate-fade-in bg-ink/40 backdrop-blur-[2px]"
    >
      <div className="animate-modal-pop w-80 max-w-[90vw] rounded-3xl bg-surface p-6 shadow-2xl ring-1 ring-ink/6">
        <div className="flex items-start gap-2.5">
          {isDestructive && (
            <AlertCircle
              className="mt-0.5 size-5 shrink-0 text-destructive"
              strokeWidth={2}
              aria-hidden="true"
            />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold leading-snug tracking-tight text-ink">
              {payload.title}
            </h2>
            {payload.description && (
              <p className="mt-1.5 whitespace-pre-line text-sm font-normal leading-relaxed text-ink">
                {payload.description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          {payload.cancelLabel && (
            <AppButton variant="secondary" size="md" className="flex-1" onClick={closeAlert}>
              {payload.cancelLabel}
            </AppButton>
          )}
          <AppButton
            variant={isDestructive ? "dangerSolid" : "primary"}
            size="md"
            className="flex-1"
            onClick={() => {
              if (firedRef.current) return;
              firedRef.current = true;
              const onConfirm = payload.onConfirm;
              closeAlert();
              onConfirm?.();
            }}
          >
            {payload.confirmLabel ?? "확인"}
          </AppButton>
        </div>
      </div>
    </ModalShell>
  );
}
