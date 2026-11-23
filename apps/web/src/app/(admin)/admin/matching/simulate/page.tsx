import Link from "next/link";
import { asc, courses, courseTags, eq, getDb, tags } from "@repo/db";
import { requireAdminSession } from "@/00_lib/session";
import { MatchingSimulatorClient } from "@/components/admin/MatchingSimulatorClient";
import { AdminPageHeader } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminMatchingSimulatePage() {
  await requireAdminSession(["ADMIN"]);
  const db = getDb();

  const [tagList, courseList, ctList] = await Promise.all([
    db.select().from(tags).where(eq(tags.isDeleted, false)).orderBy(asc(tags.category)),
    db.select().from(courses).where(eq(courses.isDeleted, false)).orderBy(asc(courses.sortOrder)),
    db.select().from(courseTags).where(eq(courseTags.isDeleted, false)),
  ]);

  const tagById = new Map(tagList.map((t) => [t.id, t.code]));
  const coursesWithTags = courseList.map((c) => ({
    id: c.id,
    title: c.title,
    tags: ctList
      .filter((ct) => ct.courseId === c.id)
      .map((ct) => ({ code: tagById.get(ct.tagId) ?? "", weight: ct.weight }))
      .filter((x) => x.code !== ""),
  }));

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="설문 매칭 점수 시뮬레이터"
        description="동일 scoreCourses() 도메인 엔진으로 실시간 추천 결과를 검증합니다."
        actions={
          <Link href="/admin/matching" className="inline-flex h-7 items-center rounded-control px-2.5 text-control atlas-border">
            매칭 개요
          </Link>
        }
      />
      <MatchingSimulatorClient tags={tagList} courses={coursesWithTags} />
    </div>
  );
}
