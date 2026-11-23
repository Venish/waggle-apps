import { notFound } from "next/navigation";
import {
  and,
  asc,
  desc,
  dogs,
  eq,
  getDb,
  lessonProgresses,
  lessons,
  lessonSteps,
  quizAttempts,
  quizQuestions,
  quizzes,
} from "@repo/db";
import { formatDateDot } from "@/00_lib/formatDate";
import { requireUserSession } from "@/00_lib/session";
import { LessonQuizClient } from "@/components/web/LessonQuizClient";
import { EmptyStateCard } from "@/components/web/WebUiKit";

export const dynamic = "force-dynamic";

export default async function LessonQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireUserSession();
  const { id } = await params;
  const lessonId = Number(id);
  if (!Number.isInteger(lessonId)) notFound();

  const db = getDb();
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
  if (!lesson) notFound();

  const myDogs = await db
    .select({ id: dogs.id, isPrimary: dogs.isPrimary })
    .from(dogs)
    .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
    .orderBy(asc(dogs.id));
  const primaryDog = myDogs.find((d) => d.isPrimary) ?? myDogs[0];

  const [step] = await db
    .select()
    .from(lessonSteps)
    .where(and(eq(lessonSteps.lessonId, lesson.id), eq(lessonSteps.type, "QUIZ"), eq(lessonSteps.isDeleted, false)))
    .limit(1);

  const [quiz] = step
    ? await db
        .select()
        .from(quizzes)
        .where(and(eq(quizzes.stepId, step.id), eq(quizzes.isDeleted, false)))
        .limit(1)
    : [];

  const questions = quiz
    ? await db
        .select({
          id: quizQuestions.id,
          text: quizQuestions.text,
          choices: quizQuestions.choices,
          answerIndex: quizQuestions.answerIndex,
          explanation: quizQuestions.explanation,
        })
        .from(quizQuestions)
        .where(and(eq(quizQuestions.quizId, quiz.id), eq(quizQuestions.isDeleted, false)))
        .orderBy(asc(quizQuestions.sortOrder))
    : [];

  const [progress] = primaryDog
    ? await db
        .select({ quizPassedAt: lessonProgresses.quizPassedAt })
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

  const [passedAttempt] =
    primaryDog && quiz && progress?.quizPassedAt
      ? await db
          .select({
            score: quizAttempts.score,
            total: quizAttempts.total,
            createdAt: quizAttempts.createdAt,
          })
          .from(quizAttempts)
          .where(
            and(
              eq(quizAttempts.dogId, primaryDog.id),
              eq(quizAttempts.quizId, quiz.id),
              eq(quizAttempts.passed, true),
            ),
          )
          .orderBy(desc(quizAttempts.createdAt))
          .limit(1)
      : [];

  const completedDateText = progress?.quizPassedAt
    ? formatDateDot(progress.quizPassedAt)
    : null;

  const initialPassedAttempt = progress?.quizPassedAt
    ? {
        score: passedAttempt?.score ?? questions.length,
        total: passedAttempt?.total ?? questions.length,
        percent:
          passedAttempt && passedAttempt.total > 0
            ? Math.round((passedAttempt.score / passedAttempt.total) * 100)
            : 100,
      }
    : null;

  return (
    <div className="flex flex-1 flex-col">
      {questions.length > 0 ? (
        <LessonQuizClient
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          lessonSummary={lesson.summary}
          completedDateText={completedDateText}
          initialPassedAttempt={initialPassedAttempt}
          questions={questions}
        />
      ) : (
        <EmptyStateCard
          title="등록된 퀴즈 문항이 없습니다"
          description="관리자 CMS에서 퀴즈 문항을 추가해 주세요."
          ctaLabel="강의로 돌아가기"
          ctaHref={`/app/lesson/${lesson.id}`}
        />
      )}
    </div>
  );
}
