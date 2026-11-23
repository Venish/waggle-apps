import { notFound } from "next/navigation";
import { and, asc, dogs, eq, getDb, lessonProgresses, lessons, lessonSteps } from "@repo/db";
import { formatDateDot } from "@/00_lib/formatDate";
import { requireUserSession } from "@/00_lib/session";
import { getPolicyNumber } from "@/04_services/shared/policyService";
import { LessonWatchClient } from "@/components/web/LessonWatchClient";

export const dynamic = "force-dynamic";

export default async function LessonWatchPage({
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

  const [videoStep] = await db
    .select()
    .from(lessonSteps)
    .where(
      and(
        eq(lessonSteps.lessonId, lesson.id),
        eq(lessonSteps.type, "VIDEO"),
        eq(lessonSteps.isDeleted, false),
      ),
    )
    .limit(1);

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

  const requiredPercent = await getPolicyNumber("watch.complete_percent");

  return (
    <LessonWatchClient
      lessonId={lesson.id}
      lessonTitle={lesson.title}
      lessonSummary={lesson.summary}
      youtubeVideoId={videoStep?.youtubeVideoId ?? (videoStep?.videoUrl ? null : "M7lc1UVf-VE")}
      videoUrl={videoStep?.videoUrl ?? null}
      requiredPercent={requiredPercent}
      initialMaxPercent={progress?.watchMaxPercent ?? 0}
      alreadyCompleted={Boolean(progress?.watchCompletedAt)}
      completedDateText={progress?.watchCompletedAt ? formatDateDot(progress.watchCompletedAt) : null}
      isDevMode={process.env.NODE_ENV !== "production"}
    />
  );
}
