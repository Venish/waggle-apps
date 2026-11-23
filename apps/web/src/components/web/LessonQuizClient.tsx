"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { PointIcon } from "@repo/ui";
import { submitLessonQuizAction } from "@/03_actions/web/onboardingEducationActions";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { LessonStepSummaryCard } from "@/components/web/LessonStepHeader";
import { AppBadge, AppButton, AppChoiceCard, AppLinkButton } from "@/components/web/ui";

interface QuizQuestionView {
  id: number;
  text: string;
  choices: string[];
  answerIndex: number;
  explanation: string | null;
}

interface PassedAttemptSummary {
  score: number;
  total: number;
  percent: number;
}

export function LessonQuizClient({
  lessonId,
  lessonTitle,
  lessonSummary = null,
  completedDateText = null,
  initialPassedAttempt = null,
  questions,
}: {
  lessonId: number;
  lessonTitle: string;
  lessonSummary?: string | null;
  completedDateText?: string | null;
  initialPassedAttempt?: PassedAttemptSummary | null;
  questions: QuizQuestionView[];
}) {
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const [isReviewMode, setIsReviewMode] = useState(Boolean(initialPassedAttempt));
  const [selected, setSelected] = useState<number[]>(() => Array(questions.length).fill(-1));
  const [result, setResult] = useState<{
    score: number;
    total: number;
    percent: number;
    passed: boolean;
    awardedPoints: number;
    bonusPoints: number;
    newBadges: string[];
  } | null>(null);
  const [pending, setPending] = useState(false);

  const handleResetQuiz = () => {
    setResult(null);
    setIsReviewMode(false);
    setSelected(Array(questions.length).fill(-1));
  };

  const handleSubmit = async () => {
    if (selected.some((x) => x < 0)) {
      openAlert({ title: "모든 퀴즈 문항에 답안을 선택해 주세요" });
      return;
    }
    setPending(true);
    try {
      const res = await submitLessonQuizAction({ lessonId, selectedIndexes: selected });
      if (!res.ok) {
        openAlert({ title: "퀴즈 제출 오류", description: res.error.message, tone: "destructive" });
        return;
      }
      setResult(res.data);
    } finally {
      setPending(false);
    }
  };

  // 이미 합격 완료한 강의: 공용 상단 카드 + 문항별 정답/해설 + [↻] [교육 홈으로] 1줄 세트
  if (isReviewMode && initialPassedAttempt && !result) {
    return (
      <div className="space-y-5">
        <LessonStepSummaryCard
          title={lessonTitle}
          completed
          completedDateText={completedDateText}
          footer={
            <p className="mt-2.5 text-base font-extrabold tabular-nums text-brand-strong">
              {initialPassedAttempt.score} / {initialPassedAttempt.total} 정답 (
              {initialPassedAttempt.percent}%)
            </p>
          }
        />

        <section>
          <h3 className="text-xs font-semibold text-ink-muted">문항별 정답 및 해설</h3>
          <ul className="mt-2 divide-y divide-border-subtle border-y border-border-subtle">
            {questions.map((q, idx) => (
              <li key={q.id} className="space-y-1.5 py-4">
                <p className="text-base font-bold leading-snug text-ink">
                  Q{idx + 1}. {q.text}
                </p>
                {q.choices[q.answerIndex] && (
                  <p className="text-sm font-bold text-brand-strong">
                    정답: {q.choices[q.answerIndex]}
                  </p>
                )}
                {q.explanation && (
                  <p className="text-sm leading-relaxed text-ink-muted">{q.explanation}</p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <div className="flex items-center gap-2.5 pt-6">
          <button
            type="button"
            onClick={handleResetQuiz}
            aria-label="퀴즈 초기화 및 다시 풀기"
            title="퀴즈 다시 풀기"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-subtle text-ink transition-colors hover:bg-ink/[0.08] active:scale-[0.96]"
          >
            <RotateCcw className="size-5" strokeWidth={2.1} />
          </button>
          <AppLinkButton href="/app" variant="primary" size="lg" className="flex-1">
            교육 홈으로
          </AppLinkButton>
        </div>
      </div>
    );
  }

  if (result) {
    const totalEarned = result.awardedPoints + result.bonusPoints;
    return (
      <div className="space-y-5">
        <LessonStepSummaryCard
          title={lessonTitle}
          completed={result.passed}
          completedDateText={result.passed ? completedDateText : null}
          footer={
            <div className="mt-2.5 space-y-2.5">
              {!result.passed && (
                <AppBadge tone="danger" size="sm">
                  아쉬워요, 다시 도전해 보세요
                </AppBadge>
              )}
              <p
                className={
                  result.passed
                    ? "text-base font-extrabold tabular-nums text-brand-strong"
                    : "text-base font-extrabold tabular-nums text-destructive"
                }
              >
                {result.score} / {result.total} 정답 ({result.percent}%)
              </p>

              {result.passed && totalEarned > 0 && (
                <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 text-sm font-bold text-ink">
                  <span className="flex items-center gap-1.5">
                    <PointIcon className="size-4 text-brand" />
                    적립 포인트
                  </span>
                  <span className="tabular-nums text-brand-strong">
                    +{totalEarned.toLocaleString("ko-KR")} P
                  </span>
                </div>
              )}

              {result.passed && result.newBadges.length > 0 && (
                <div className="rounded-2xl bg-brand-soft px-4 py-2.5 text-xs font-bold text-brand-strong">
                  새 배지 획득: {result.newBadges.join(", ")}
                </div>
              )}
            </div>
          }
        />

        <section>
          <h3 className="text-xs font-semibold text-ink-muted">문항별 정답 및 해설</h3>
          <ul className="mt-2 divide-y divide-border-subtle border-y border-border-subtle">
            {questions.map((q, idx) => (
              <li key={q.id} className="space-y-1.5 py-4">
                <p className="text-base font-bold leading-snug text-ink">
                  Q{idx + 1}. {q.text}
                </p>
                {q.choices[q.answerIndex] && (
                  <p className="text-sm font-bold text-brand-strong">
                    정답: {q.choices[q.answerIndex]}
                  </p>
                )}
                {q.explanation && (
                  <p className="text-sm leading-relaxed text-ink-muted">{q.explanation}</p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <div className="pt-6">
          {result.passed ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleResetQuiz}
                aria-label="퀴즈 초기화 및 다시 풀기"
                title="퀴즈 다시 풀기"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-subtle text-ink transition-colors hover:bg-ink/[0.08] active:scale-[0.96]"
              >
                <RotateCcw className="size-5" strokeWidth={2.1} />
              </button>
              <AppLinkButton href="/app" variant="primary" size="lg" className="flex-1">
                교육 홈으로
              </AppLinkButton>
            </div>
          ) : (
            <AppButton variant="primary" size="lg" fullWidth onClick={handleResetQuiz}>
              퀴즈 다시 풀기
            </AppButton>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <LessonStepSummaryCard
        title={lessonTitle}
        description={lessonSummary || "강의를 잘 이해했는지 퀴즈로 확인해 보세요."}
        completed={Boolean(initialPassedAttempt)}
        completedDateText={completedDateText}
      />

      <div className="space-y-5">
        {questions.map((q, qIdx) => (
          <section key={q.id} className="space-y-3 border-b border-border-subtle pb-5 last:border-b-0">
            <p className="text-base font-bold leading-snug text-ink">
              Q{qIdx + 1}. {q.text}
            </p>
            <div className="space-y-2" role="radiogroup" aria-label={`문항 ${qIdx + 1}`}>
              {q.choices.map((choice, cIdx) => (
                <AppChoiceCard
                  key={choice}
                  selected={selected[qIdx] === cIdx}
                  onClick={() =>
                    setSelected((prev) => prev.map((v, i) => (i === qIdx ? cIdx : v)))
                  }
                  title={choice}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="pt-6">
        <AppButton variant="primary" size="lg" fullWidth loading={pending} onClick={handleSubmit}>
          {pending ? "채점 중..." : "최종 퀴즈 제출하기"}
        </AppButton>
      </div>
    </div>
  );
}
