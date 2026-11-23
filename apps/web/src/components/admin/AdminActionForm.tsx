"use client";

import { useRef, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@repo/types";
import { useAdminAlertStore } from "@/01_store/admin/useAdminAlertStore";

interface AdminActionFormProps {
  action: (formData: FormData) => Promise<ActionResult<unknown>>;
  className?: string;
  children: ReactNode;
  errorTitle?: string;
  successTitle?: string;
  successMessage?: string;
  confirmTitle?: string;
  confirmDescription?: string;
  confirmLabel?: string;
  confirmTone?: "default" | "negative";
  redirectTo?: string;
  redirectIdPrefix?: string;
  resetOnSuccess?: boolean;
}

export function AdminActionForm({
  action,
  className,
  children,
  errorTitle = "처리 실패",
  successTitle = "완료",
  successMessage,
  confirmTitle,
  confirmDescription,
  confirmLabel = "진행",
  confirmTone = "negative",
  redirectTo,
  redirectIdPrefix,
  resetOnSuccess = false,
}: AdminActionFormProps) {
  const router = useRouter();
  const openAlert = useAdminAlertStore((s) => s.openAlert);
  const formRef = useRef<HTMLFormElement>(null);
  const lockRef = useRef(false);
  const [pending, startTransition] = useTransition();

  const runAction = (fd: FormData) => {
    if (lockRef.current) return;
    lockRef.current = true;
    startTransition(async () => {
      try {
        const res = await action(fd);
        if (!res.ok) {
          openAlert({
            title: errorTitle,
            description: res.error.message,
            tone: "negative",
          });
          return;
        }

        if (resetOnSuccess) {
          formRef.current?.reset();
        }

        const dataId =
          res.data &&
          typeof res.data === "object" &&
          "id" in res.data &&
          typeof (res.data as { id?: unknown }).id === "number"
            ? (res.data as { id: number }).id
            : null;

        const targetUrl =
          redirectIdPrefix && dataId !== null ? `${redirectIdPrefix}/${dataId}` : redirectTo;

        if (successMessage) {
          openAlert({
            title: successTitle,
            description: successMessage,
            onConfirm: () => {
              if (targetUrl) {
                router.push(targetUrl);
              }
              router.refresh();
            },
          });
          if (!targetUrl) {
            router.refresh();
          }
          return;
        }

        if (targetUrl) {
          router.push(targetUrl);
        }
        router.refresh();
      } catch {
        openAlert({
          title: errorTitle,
          description: "요청 처리 중 예기치 않은 오류가 발생했습니다.",
          tone: "negative",
        });
      } finally {
        lockRef.current = false;
      }
    });
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending || lockRef.current || !formRef.current) return;
    const fd = new FormData(formRef.current);

    if (confirmTitle) {
      openAlert({
        title: confirmTitle,
        description: confirmDescription,
        confirmLabel,
        cancelLabel: "취소",
        tone: confirmTone,
        onConfirm: () => runAction(fd),
      });
      return;
    }

    runAction(fd);
  };

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      aria-busy={pending}
      className={className}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
