"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSurveyResponsesAction } from "@/03_actions/web/onboardingEducationActions";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { AppButton, AppChoiceCard } from "@/components/web/ui";

interface SurveyOption {
  id: number;
  text: string;
}

const STORAGE_KEY = "waggle_survey_answers_v1";

function loadMap(): Record<number, number[]> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}") as Record<number, number[]>;
  } catch {
    return {};
  }
}

export function SurveyStepClient({
  step,
  totalSteps,
  questionId,
  questionText,
  allowMultiple,
  options,
}: {
  step: number;
  totalSteps: number;
  questionId: number;
  questionText: string;
  allowMultiple: boolean;
  options: SurveyOption[];
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const [selected, setSelected] = useState<number[]>(() => loadMap()[questionId] ?? []);
  const [isPending, setIsPending] = useState(false);

  const toggle = (answerId: number) => {
    if (allowMultiple) {
      setSelected((prev) =>
        prev.includes(answerId) ? prev.filter((id) => id !== answerId) : [...prev, answerId],
      );
    } else {
      setSelected([answerId]);
    }
  };

  const handleNext = async () => {
    if (selected.length === 0) {
      openAlert({ title: "하나 이상 선택해 주세요" });
      return;
    }

    const map = loadMap();
    map[questionId] = selected;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));

    if (step < totalSteps) {
      router.push(`/app/onboarding/survey/${step + 1}`);
      return;
    }

    setIsPending(true);
    try {
      const allIds = Object.values(map).flat();
      const res = await saveSurveyResponsesAction({ answerIds: allIds });
      if (!res.ok) {
        openAlert({ title: "저장 실패", description: res.error.message, tone: "destructive" });
        return;
      }
      sessionStorage.removeItem(STORAGE_KEY);
      router.push("/app/onboarding/result");
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  const pct = Math.round((step / totalSteps) * 100);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold tabular-nums text-ink-muted">
          <span>
            질문 {step} / {totalSteps}
          </span>
          <span className="text-brand-strong">{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-250"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div>
        <h1 className="text-xl font-extrabold leading-snug tracking-tight text-ink">
          {questionText}
        </h1>
        {allowMultiple && (
          <p className="mt-1.5 text-sm font-medium text-ink-muted">복수 선택 가능</p>
        )}
      </div>

      <div
        className="space-y-2"
        role={allowMultiple ? "group" : "radiogroup"}
        aria-label={questionText}
      >
        {options.map((opt) => (
          <AppChoiceCard
            key={opt.id}
            multiple={allowMultiple}
            selected={selected.includes(opt.id)}
            onClick={() => toggle(opt.id)}
            title={opt.text}
          />
        ))}
      </div>

      <div className="flex gap-2 pt-4">
        {step > 1 && (
          <AppButton
            variant="secondary"
            size="lg"
            className="w-24 shrink-0"
            onClick={() => router.push(`/app/onboarding/survey/${step - 1}`)}
          >
            이전
          </AppButton>
        )}
        <AppButton
          variant="primary"
          size="lg"
          className="flex-1"
          loading={isPending}
          onClick={handleNext}
        >
          {isPending ? "분석 중..." : step < totalSteps ? "다음" : "맞춤 강좌 보기"}
        </AppButton>
      </div>
    </div>
  );
}
