"use client";

import { useEffect } from "react";
import { WebStatusView } from "@/components/web/WebStatusView";

export default function WwwErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[www] unhandled error:", error);
  }, [error]);

  return (
    <WebStatusView
      code="500"
      title="잠시 문제가 생겼어요"
      description="일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
      primaryAction={{ label: "다시 시도", onClick: reset }}
      secondaryAction={{ label: "와글 홈으로", href: "/" }}
      fullViewport
    />
  );
}
