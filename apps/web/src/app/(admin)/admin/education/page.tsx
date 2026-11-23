import Link from "next/link";
import { Plus } from "lucide-react";
import { asc, courses, eq, getDb, lessons, units } from "@repo/db";
import { requireAdminSession } from "@/00_lib/session";
import { getEducationPolicies } from "@/04_services/shared/policyService";
import {
  AdminEducationConsoleClient,
  type AdminCourseRowItem,
} from "@/components/admin/AdminEducationConsoleClient";
import { AdminPageHeader } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminEducationPage() {
  await requireAdminSession(["ADMIN"]);
  const db = getDb();

  const [policies, courseList, unitList, lessonList] = await Promise.all([
    getEducationPolicies(),
    db
      .select()
      .from(courses)
      .where(eq(courses.isDeleted, false))
      .orderBy(asc(courses.level), asc(courses.sortOrder), asc(courses.id)),
    db
      .select({ id: units.id, courseId: units.courseId })
      .from(units)
      .where(eq(units.isDeleted, false)),
    db
      .select({ id: lessons.id, unitId: lessons.unitId })
      .from(lessons)
      .where(eq(lessons.isDeleted, false)),
  ]);

  const unitCountByCourse = new Map<number, number>();
  const courseIdByUnit = new Map<number, number>();
  for (const u of unitList) {
    unitCountByCourse.set(u.courseId, (unitCountByCourse.get(u.courseId) ?? 0) + 1);
    courseIdByUnit.set(u.id, u.courseId);
  }

  const lessonCountByCourse = new Map<number, number>();
  for (const l of lessonList) {
    const cid = courseIdByUnit.get(l.unitId);
    if (cid !== undefined) {
      lessonCountByCourse.set(cid, (lessonCountByCourse.get(cid) ?? 0) + 1);
    }
  }

  const rows: AdminCourseRowItem[] = courseList.map((c) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    level: c.level,
    isPremium: c.isPremium,
    isPublished: c.isPublished,
    unitCount: unitCountByCourse.get(c.id) ?? 0,
    lessonCount: lessonCountByCourse.get(c.id) ?? 0,
  }));

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="강좌 · 강의 관리"
        description="강좌 · 챕터 · 강의 · 영상 · 퀴즈 관리 및 교육 점수 · 학년 승급 기준 일괄 설정"
        actions={
          <Link
            href="/admin/education/new"
            className="inline-flex h-7 items-center gap-1.5 rounded-control bg-inverse px-2.5 text-control font-medium text-on-inverse"
          >
            <Plus className="size-3.5" strokeWidth={1.75} />
            신규 강좌 생성
          </Link>
        }
      />

      <AdminEducationConsoleClient initialPolicies={policies} courses={rows} />
    </div>
  );
}
