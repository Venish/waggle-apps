"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { enrollCourseAction } from "@/03_actions/web/onboardingEducationActions";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { AppButton } from "@/components/web/ui";

export function EnrollCourseButton({
  courseId,
  label = "이 강좌 수강 시작",
  redirectTo = "/app/onboarding/daily-goal",
}: {
  courseId: number;
  label?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    try {
      const res = await enrollCourseAction(courseId);
      if (!res.ok) {
        openAlert({ title: "수강 시작 실패", description: res.error.message, tone: "destructive" });
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <AppButton variant="primary" size="md" fullWidth loading={pending} onClick={handleClick}>
      {pending ? "등록 중..." : label}
    </AppButton>
  );
}
