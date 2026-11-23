"use client";

import { useState } from "react";
import { Award } from "lucide-react";
import { submitLevelTestAction } from "@/03_actions/web/onboardingEducationActions";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { AppBadge, AppButton, AppChoiceCard, AppLinkButton } from "@/components/web/ui";

interface LevelTestQuestion {
  text: string;
  choices: string[];
}

export function LevelTestClient({
  levelTestId,
  title,
  questions,
}: {
  levelTestId: number;
  title: string;
  questions: LevelTestQuestion[];
}) {
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const [answers, setAnswers] = useState<number[]>(() => Array(questions.length).fill(-1));
  const [result, setResult] = useState<{
    score: number;
    total: number;
    percent: number;
    passed: boolean;
    skippedLessons: number;
  } | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async () => {
    if (answers.some((a) => a < 0)) {
      openAlert({ title: "모든 문항의 답안을 선택해 주세요" });
      return;
    }
    setIsPending(true);
    try {
      const res = await submitLevelTestAction({ levelTestId, selectedIndexes: answers });
      if (!res.ok) {
        openAlert({ title: "제출 오류", description: res.error.message, tone: "destructive" });
        return;
      }
      setResult(res.data);
    } finally {
      setIsPending(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl bg-surface-subtle p-5">
          <AppBadge tone={result.passed ? "brand" : "neutral"} size="md">
            <Award className="size-3.5" strokeWidth={2} />
            {result.passed ? "레벨테스트 통과" : "기초부터 탄탄히 시작"}
          </AppBadge>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight tabular-nums text-ink">
            {result.score} / {result.total} 정답 ({result.percent}%)
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            {result.passed
              ? `기초 강의 ${result.skippedLessons}개가 이수 처리되었어요.`
              : "1강부터 차근차근 시작해 보세요."}
          </p>
        </section>

        <div className="pt-4">
          <AppLinkButton href="/app/onboarding/daily-goal" variant="primary" size="lg" fullWidth>
            목표 설정하기
          </AppLinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-surface-subtle p-4">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          통과하면 기초 강의를 건너뛰고 다음 단계부터 시작할 수 있어요.
        </p>
      </div>

      {questions.map((q, qIdx) => (
        <section
          key={q.text}
          className="space-y-3 border-b border-border-subtle pb-5 last:border-b-0"
        >
          <p className="text-base font-bold leading-snug text-ink">
            Q{qIdx + 1}. {q.text}
          </p>
          <div className="space-y-2" role="radiogroup" aria-label={`문항 ${qIdx + 1}`}>
            {q.choices.map((choice, cIdx) => (
              <AppChoiceCard
                key={choice}
                selected={answers[qIdx] === cIdx}
                onClick={() =>
                  setAnswers((prev) => prev.map((v, i) => (i === qIdx ? cIdx : v)))
                }
                title={choice}
              />
            ))}
          </div>
        </section>
      ))}

      <div className="pt-4">
        <AppButton variant="primary" size="lg" fullWidth loading={isPending} onClick={handleSubmit}>
          {isPending ? "채점 중..." : "제출하기"}
        </AppButton>
      </div>
    </div>
  );
}
