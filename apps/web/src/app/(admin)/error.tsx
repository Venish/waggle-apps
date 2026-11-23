"use client";

import { useEffect } from "react";
import { AdminStatusView } from "@/components/admin/AdminStatusView";

export default function AdminErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] unhandled error:", error);
  }, [error]);

  return (
    <AdminStatusView
      code="500"
      title="운영 콘솔 오류가 발생했습니다"
      description="요청 처리 중 예기치 않은 문제가 발생했습니다. 다시 시도해 주세요."
      digest={error.digest}
      primaryAction={{ label: "다시 시도", onClick: reset }}
      secondaryAction={{ label: "대시보드로 이동", href: "/admin/dashboard" }}
    />
  );
}
