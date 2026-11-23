"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@repo/ui";
import { completeLessonPracticeAction } from "@/03_actions/web/onboardingEducationActions";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { LessonStepSummaryCard } from "@/components/web/LessonStepHeader";
import { AppButton, AppCheckbox, AppLinkButton } from "@/components/web/ui";

export function LessonPracticeClient({
  lessonId,
  lessonTitle,
  alreadyCompleted = false,
  completedDateText = null,
  items,
}: {
  lessonId: number;
  lessonTitle: string;
  alreadyCompleted?: boolean;
  completedDateText?: string | null;
  items: Array<{ id: number; text: string }>;
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const [checkedIds, setCheckedIds] = useState<number[]>(() =>
    alreadyCompleted ? items.map((item) => item.id) : [],
  );
  const [pending, setPending] = useState(false);

  const toggle = (id: number) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allChecked = items.length > 0 && checkedIds.length === items.length;

  const handleComplete = async () => {
    if (!allChecked) {
      openAlert({ title: "모든 실습 항목을 체크해 주세요" });
      return;
    }
    setPending(true);
    try {
      const res = await completeLessonPracticeAction(lessonId);
      if (!res.ok) {
        openAlert({ title: "실습 저장 실패", description: res.error.message, tone: "destructive" });
        return;
      }
      if (res.data.awardedPoints > 0) {
        openAlert({
          title: "2단계 실습 완료",
          description: `+${res.data.awardedPoints}P가 적립되었습니다! 마지막 3단계 퀴즈에 도전해 보세요.`,
          confirmLabel: "3단계 퀴즈 보기",
          onConfirm: () => {
            router.replace(`/app/lesson/${lessonId}/quiz`, {
              transitionTypes: ["waggle-push-forward"],
            });
          },
        });
      } else {
        router.replace(`/app/lesson/${lessonId}/quiz`, {
          transitionTypes: ["waggle-push-forward"],
        });
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-5">
      <LessonStepSummaryCard
        title={lessonTitle}
        description={
          alreadyCompleted
            ? "실습 체크를 모두 마쳤어요. 필요할 때 항목을 다시 점검해 보세요."
            : "강아지와 직접 연습한 뒤 하나씩 체크해 주세요."
        }
        completed={alreadyCompleted}
        completedDateText={completedDateText}
      />

      <div className="space-y-2.5">
        {items.map((item) => {
          const isChecked = checkedIds.includes(item.id);
          return (
            <div
              key={item.id}
              className={cn(
                "rounded-2xl px-4 py-1 transition-colors duration-150",
                isChecked ? "bg-brand-soft" : "bg-surface-subtle",
              )}
            >
              <AppCheckbox
                checked={isChecked}
                onChange={() => toggle(item.id)}
                label={item.text}
                className="py-3"
              />
            </div>
          );
        })}
      </div>

      <div className="pt-6">
        {alreadyCompleted ? (
          <AppLinkButton
            href={`/app/lesson/${lessonId}/quiz`}
            variant="primary"
            size="lg"
            fullWidth
          >
            3단계 퀴즈 보기
          </AppLinkButton>
        ) : (
          <AppButton
            variant="primary"
            size="lg"
            fullWidth
            loading={pending}
            disabled={!allChecked}
            onClick={handleComplete}
          >
            {pending ? "저장 중..." : `실습 완료 (${checkedIds.length}/${items.length})`}
          </AppButton>
        )}
      </div>
    </div>
  );
}
