"use client";

import { useEffect } from "react";
import { WebStatusView } from "@/components/web/WebStatusView";

export default function MobileErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[mobile] unhandled error:", error);
  }, [error]);

  return (
    <WebStatusView
      code="500"
      title="잠시 문제가 생겼어요"
      description="화면을 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요."
      primaryAction={{ label: "다시 시도", onClick: reset }}
      secondaryAction={{ label: "교육 홈으로", href: "/app" }}
    />
  );
}
