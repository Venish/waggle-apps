import { notFound } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import {
  and,
  asc,
  dogs,
  eq,
  getDb,
  lessonProgresses,
  lessons,
} from "@repo/db";
import { cn } from "@repo/ui";
import { formatDateDot } from "@/00_lib/formatDate";
import { requireUserSession } from "@/00_lib/session";
import { getPolicyNumber } from "@/04_services/shared/policyService";
import { AppBadge, AppLink } from "@/components/web/ui";

export const dynamic = "force-dynamic";

export default async function LessonOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireUserSession();
  const { id } = await params;
  const lessonId = Number(id);
  if (!Number.isInteger(lessonId)) notFound();

  const db = getDb();
  const [lesson] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), eq(lessons.isDeleted, false)))
    .limit(1);
  if (!lesson) notFound();

  const myDogs = await db
    .select()
    .from(dogs)
    .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
    .orderBy(asc(dogs.id));
  const primaryDog = myDogs.find((d) => d.isPrimary) ?? myDogs[0];

  const [progress] = primaryDog
    ? await db
        .select()
        .from(lessonProgresses)
        .where(
          and(
            eq(lessonProgresses.dogId, primaryDog.id),
            eq(lessonProgresses.lessonId, lesson.id),
            eq(lessonProgresses.isDeleted, false),
          ),
        )
        .limit(1)
    : [];

  const [watchPct, pWatch, pPractice, pQuiz] = await Promise.all([
    getPolicyNumber("watch.complete_percent"),
    getPolicyNumber("point.watch"),
    getPolicyNumber("point.practice"),
    getPolicyNumber("point.quiz"),
  ]);

  const completedDateText = progress?.completedAt ? formatDateDot(progress.completedAt) : null;

  const steps = [
    {
      num: "01",
      title: `1단계 · 강의 영상 시청 (${watchPct}%)`,
      desc: progress?.watchCompletedAt
        ? `${formatDateDot(progress.watchCompletedAt)} 시청 완료`
        : `최초 완료 시 +${pWatch}P 적립`,
      done: Boolean(progress?.watchCompletedAt),
      actionLabel: progress?.watchCompletedAt ? "다시 보기" : "시작",
      href: `/app/lesson/${lesson.id}/watch`,
    },
    {
      num: "02",
      title: "2단계 · 보호자 실습 체크",
      desc: progress?.practiceCompletedAt
        ? `${formatDateDot(progress.practiceCompletedAt)} 실습 완료`
        : `최초 완료 시 +${pPractice}P 적립`,
      done: Boolean(progress?.practiceCompletedAt),
      actionLabel: progress?.practiceCompletedAt ? "복습" : "시작",
      href: `/app/lesson/${lesson.id}/practice`,
    },
    {
      num: "03",
      title: "3단계 · 최종 퀴즈",
      desc: progress?.quizPassedAt
        ? `${formatDateDot(progress.quizPassedAt)} 합격 완료`
        : `통과 시 +${pQuiz}P 적립 & 강의 완료`,
      done: Boolean(progress?.quizPassedAt),
      actionLabel: progress?.quizPassedAt ? "해설 보기" : "시작",
      href: `/app/lesson/${lesson.id}/quiz`,
    },
  ];

  return (
    <div className="space-y-5">
      <section className="-mx-4 bg-surface-subtle px-4 pb-5 pt-8">
        <div className="flex flex-wrap items-center gap-2">
          <AppBadge tone={progress?.completedAt ? "brand" : "neutral"} size="md">
            {progress?.completedAt ? "강의 완료" : "수강 중"}
          </AppBadge>
          {completedDateText && (
            <span className="text-xs font-semibold tabular-nums text-ink-muted">
              {completedDateText} 완료
            </span>
          )}
        </div>
        <h2 className="mt-2.5 text-xl font-extrabold tracking-tight text-ink">{lesson.title}</h2>
        {lesson.summary && (
          <p className="mt-1.5 text-base font-normal leading-relaxed text-ink">{lesson.summary}</p>
        )}
      </section>

      <ul className="space-y-2.5">
        {steps.map((st) => (
          <li key={st.num}>
            <AppLink
              href={st.href}
              className={`flex items-center justify-between gap-3 rounded-2xl p-4 transition-[background-color,transform] duration-150 active:scale-[0.98] ${
                st.done
                  ? "bg-brand-soft/75 hover:bg-brand-soft"
                  : "bg-surface-subtle hover:bg-ink/[0.045]"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-lg border-2 transition-colors",
                    st.done
                      ? "border-brand bg-brand text-surface"
                      : "border-ink/20 bg-surface text-ink/20",
                  )}
                >
                  <Check className="size-3.5" strokeWidth={2.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{st.title}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-ink-muted">{st.desc}</p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-ink">
                <span className={st.done ? "text-brand-strong" : "text-ink-muted"}>
                  {st.actionLabel}
                </span>
                <ChevronRight className="size-4 text-ink-muted" strokeWidth={1.8} />
              </span>
            </AppLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
