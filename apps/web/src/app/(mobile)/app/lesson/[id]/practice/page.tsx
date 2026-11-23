import { notFound } from "next/navigation";
import {
  and,
  asc,
  dogs,
  eq,
  getDb,
  lessonProgresses,
  lessons,
  lessonSteps,
  practiceChecklists,
} from "@repo/db";
import { formatDateDot } from "@/00_lib/formatDate";
import { requireUserSession } from "@/00_lib/session";
import { LessonPracticeClient } from "@/components/web/LessonPracticeClient";

export const dynamic = "force-dynamic";

export default async function LessonPracticePage({
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

  const [progress] = primaryDog
    ? await db
        .select({ practiceCompletedAt: lessonProgresses.practiceCompletedAt })
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

  const [step] = await db
    .select()
    .from(lessonSteps)
    .where(and(eq(lessonSteps.lessonId, lesson.id), eq(lessonSteps.type, "PRACTICE"), eq(lessonSteps.isDeleted, false)))
    .limit(1);

  const items = step
    ? await db
        .select({ id: practiceChecklists.id, text: practiceChecklists.text })
        .from(practiceChecklists)
        .where(and(eq(practiceChecklists.stepId, step.id), eq(practiceChecklists.isDeleted, false)))
        .orderBy(asc(practiceChecklists.sortOrder))
    : [];

  return (
    <LessonPracticeClient
      lessonId={lesson.id}
      lessonTitle={lesson.title}
      alreadyCompleted={Boolean(progress?.practiceCompletedAt)}
      completedDateText={progress?.practiceCompletedAt ? formatDateDot(progress.practiceCompletedAt) : null}
      items={items.length > 0 ? items : [{ id: 1, text: "강아지와 핵심 동작을 3회 이상 연습했어요." }]}
    />
  );
}
