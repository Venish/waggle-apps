"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@repo/ui";
import { SubPageHeader } from "@/components/web/SubPageHeader";
import { AppBadge } from "@/components/web/ui";

const STEP_META = [
  { key: "watch", title: "1단계 · 영상 수강", label: "영상", step: 1 },
  { key: "practice", title: "2단계 · 실습 체크", label: "실습", step: 2 },
  { key: "quiz", title: "3단계 · 최종 퀴즈", label: "퀴즈", step: 3 },
] as const;

/**
 * 1·2·3단계(/watch, /practice, /quiz) 공통 상단 강의 정보 카드
 * - 완료 배지("학습 완료" + 완료 날짜) · 제목(text-xl) · 설명(text-base text-ink) 포맷 100% 통일
 */
export function LessonStepSummaryCard({
  title,
  description,
  completed = false,
  completedDateText = null,
  footer,
}: {
  title: string;
  description?: string | null;
  completed?: boolean;
  completedDateText?: string | null;
  footer?: ReactNode;
}) {
  return (
    <section className="-mx-4 bg-surface-subtle px-4 pb-5 pt-8">
      {completed && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <AppBadge tone="brand" size="sm">
            <CheckCircle2 className="size-3" strokeWidth={2.2} />
            학습 완료
          </AppBadge>
          {completedDateText && (
            <span className="text-xs font-semibold tabular-nums text-ink-muted">
              {completedDateText} 완료
            </span>
          )}
        </div>
      )}
      <h2 className="text-xl font-extrabold leading-snug tracking-tight text-ink">{title}</h2>
      {description && (
        <p className="mt-1.5 text-base font-normal leading-relaxed text-ink">{description}</p>
      )}
      {footer}
    </section>
  );
}

/**
 * /app/lesson/[id] 및 하위 3단계(/watch, /practice, /quiz) 공통 상단 헤더
 * - 전 화면과 100% 동일한 SubPageHeader 규격([<] | 정중앙 타이틀 | [1/3]) 유지
 * - 3단계 화면에서는 헤더 바로 아래 본문 최상단에 슬림 3칸 스텝 진행 바 배치
 */
export function LessonStepHeader({
  lessonId,
  courseId,
}: {
  lessonId: number;
  courseId: number;
}) {
  const pathname = usePathname();

  const activeMeta = pathname.endsWith("/watch")
    ? STEP_META[0]
    : pathname.endsWith("/practice")
      ? STEP_META[1]
      : pathname.endsWith("/quiz")
        ? STEP_META[2]
        : null;

  if (!activeMeta) {
    return <SubPageHeader title="강의 안내" backHref={`/app/courses/${courseId}`} />;
  }

  return (
    <>
      <SubPageHeader
        title={activeMeta.title}
        backHref={`/app/lesson/${lessonId}`}
        forceBackHref
        mode="push"
        right={
          <span className="text-xs font-extrabold tabular-nums text-ink-muted">
            <strong className="text-brand-strong">{activeMeta.step}</strong>/3
          </span>
        }
      />

      {/* 헤더 바로 아래 0px 밀착 풀블리드 3칸 스텝 진행 바 */}
      <div
        className="-mx-4 flex items-center gap-0.5 bg-surface-subtle"
        role="progressbar"
        aria-label={`강의 3단계 중 ${activeMeta.step}단계 (${activeMeta.label})`}
        aria-valuenow={activeMeta.step}
        aria-valuemin={1}
        aria-valuemax={3}
      >
        {STEP_META.map((item) => {
          const filled = item.step <= activeMeta.step;
          return (
            <span
              key={item.key}
              className={cn(
                "h-1 flex-1 transition-colors duration-200",
                filled ? "bg-brand" : "bg-ink/10",
              )}
            />
          );
        })}
      </div>
    </>
  );
}
