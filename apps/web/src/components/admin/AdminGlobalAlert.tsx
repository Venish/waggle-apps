"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { cn, ModalShell } from "@repo/ui";
import { useAdminAlertStore } from "@/01_store/admin/useAdminAlertStore";

export function AdminGlobalAlert() {
  const isOpen = useAdminAlertStore((s) => s.isOpen);
  const payload = useAdminAlertStore((s) => s.payload);
  const closeAlert = useAdminAlertStore((s) => s.closeAlert);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [isOpen, payload]);

  if (!isOpen || !payload) return null;

  const isNegative = payload.tone === "negative";

  return (
    <ModalShell
      open={isOpen}
      onClose={closeAlert}
      closeOnOverlayClick={false}
      closeOnEscape={false}
      role="alertdialog"
      ariaLabel={payload.title}
      containerClassName="z-50 p-4"
      overlayClassName="bg-[var(--bg-overlay)] backdrop-blur-xs"
    >
      <div className="w-96 max-w-[90vw] rounded-panel bg-base-3 p-4 shadow-lg atlas-border">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-badge",
              isNegative ? "bg-negative/15 text-negative" : "bg-info/15 text-info",
            )}
          >
            <AlertTriangle className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-floating-title font-semibold leading-snug text-neutral">
              {payload.title}
            </h2>
            {payload.description && (
              <p className="mt-1.5 text-control leading-relaxed text-secondary">
                {payload.description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          {payload.cancelLabel && (
            <button
              type="button"
              onClick={closeAlert}
              className="inline-flex h-7 items-center justify-center rounded-control px-2.5 text-control font-medium text-neutral atlas-border transition-colors hover:bg-[var(--mix-hover-subtle)]"
            >
              {payload.cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (firedRef.current) return;
              firedRef.current = true;
              const onConfirm = payload.onConfirm;
              closeAlert();
              onConfirm?.();
            }}
            className={cn(
              "inline-flex h-7 items-center justify-center rounded-control px-3 text-control font-medium transition-opacity hover:opacity-90",
              isNegative ? "bg-negative text-white" : "bg-inverse text-on-inverse",
            )}
          >
            {payload.confirmLabel ?? "확인"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
