"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  adminSoftDeleteBreedAction,
  adminSoftDeleteCommonCodeAction,
} from "@/03_actions/admin/adminUserCodeActions";
import { useAdminAlertStore } from "@/01_store/admin/useAdminAlertStore";

export function AdminSoftDeleteCodeButton({
  kind,
  id,
}: {
  kind: "code" | "breed";
  id: number;
}) {
  const router = useRouter();
  const openAlert = useAdminAlertStore((s) => s.openAlert);
  const [pending, setPending] = useState(false);

  const handleDelete = async () => {
    setPending(true);
    try {
      const res =
        kind === "code"
          ? await adminSoftDeleteCommonCodeAction(id)
          : await adminSoftDeleteBreedAction(id);
      if (!res.ok) {
        openAlert({
          title: "참조 데이터 삭제 차단",
          description: res.error.message,
          tone: "negative",
        });
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleDelete}
      className="inline-flex h-6 items-center gap-1 rounded-btn-sm px-2 text-xs text-negative atlas-border hover:bg-negative/10"
    >
      <Trash2 className="size-3" strokeWidth={1.75} />
      삭제
    </button>
  );
}
