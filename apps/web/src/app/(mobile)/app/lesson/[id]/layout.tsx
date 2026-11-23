import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { and, courses, courseUnlocks, eq, getDb, lessons, units } from "@repo/db";
import { requireUserSession } from "@/00_lib/session";
import { LessonStepHeader } from "@/components/web/LessonStepHeader";

/**
 * /app/lesson/[id] (+ /watch, /practice, /quiz) 통합 페이월 & 유효성 가드
 * - 미결제 프리미엄 코스 레슨 URL 직통 접근을 서버 레이아웃 단계에서 원천 차단한다.
 */
export default async function LessonGuardLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: ReactNode;
}) {
  const session = await requireUserSession();
  const { id } = await params;
  const lessonId = Number(id);
  if (!Number.isInteger(lessonId) || lessonId <= 0) notFound();

  const db = getDb();
  const [row] = await db
    .select({
      lessonId: lessons.id,
      courseId: courses.id,
      isPremium: courses.isPremium,
      isPublished: courses.isPublished,
    })
    .from(lessons)
    .innerJoin(units, and(eq(units.id, lessons.unitId), eq(units.isDeleted, false)))
    .innerJoin(courses, and(eq(courses.id, units.courseId), eq(courses.isDeleted, false)))
    .where(and(eq(lessons.id, lessonId), eq(lessons.isDeleted, false)))
    .limit(1);

  if (!row || !row.isPublished) notFound();

  if (row.isPremium) {
    const [unlocked] = await db
      .select({ id: courseUnlocks.id })
      .from(courseUnlocks)
      .where(
        and(
          eq(courseUnlocks.userId, session.userId),
          eq(courseUnlocks.courseId, row.courseId),
          eq(courseUnlocks.isDeleted, false),
        ),
      )
      .limit(1);
    if (!unlocked) {
      redirect(`/app/courses/${row.courseId}`);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <LessonStepHeader lessonId={row.lessonId} courseId={row.courseId} />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
