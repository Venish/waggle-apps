import { Suspense } from "react";
import { LoginFormClient } from "@/components/web/LoginFormClient";

export default function OnboardingLoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-ink-muted">로딩 중...</div>}>
      <LoginFormClient />
    </Suspense>
  );
}
