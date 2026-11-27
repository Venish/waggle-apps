import Link from "next/link";
import { asc, courses, courseTags, eq, getDb, tags } from "@repo/db";
import { requireAdminSession } from "@/00_lib/session";
import { adminUpsertCourseTagWeightAction } from "@/03_actions/admin/adminEducationMatchingActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import {
  adminButtonClass,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
} from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminMatchingOverviewPage() {
  await requireAdminSession(["ADMIN"]);
  const db = getDb();

  const [courseList, tagList, ctList] = await Promise.all([
    db.select().from(courses).where(eq(courses.isDeleted, false)).orderBy(asc(courses.sortOrder)),
    db.select().from(tags).where(eq(tags.isDeleted, false)).orderBy(asc(tags.category), asc(tags.code)),
    db.select().from(courseTags).where(eq(courseTags.isDeleted, false)),
  ]);

  async function saveWeight(formData: FormData) {
    "use server";
    return adminUpsertCourseTagWeightAction({
      courseId: Number(formData.get("courseId")),
      tagId: Number(formData.get("tagId")),
      weight: Number(formData.get("weight") ?? 1),
    });
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="온보딩 매칭 · 강좌-태그 가중치"
        description="설문 응답 태그 × 강좌 태그 가중치 내적으로 맞춤 강좌를 추천합니다."
        actions={
          <>
            <Link href="/admin/matching/survey" className="inline-flex h-7 items-center rounded-control px-2.5 text-control atlas-border">
              설문 문항 편집
            </Link>
            <Link href="/admin/matching/tags" className="inline-flex h-7 items-center rounded-control px-2.5 text-control atlas-border">
              태그 마스터
            </Link>
            <Link href="/admin/matching/simulate" className="inline-flex h-7 items-center rounded-control bg-inverse px-2.5 text-control font-medium text-on-inverse">
              매칭 시뮬레이터
            </Link>
          </>
        }
      />

      <AdminActionForm
        action={saveWeight}
        errorTitle="가중치 저장 실패"
        successMessage="강좌-태그 가중치가 저장되었습니다."
        className="flex flex-wrap items-center gap-2 rounded-panel bg-base-2 p-3 atlas-border"
      >
        <AdminSelect
          name="courseId"
          defaultValue={String(courseList[0]?.id ?? "")}
          ariaLabel="강좌 선택"
          size="sm"
          className="w-56"
          options={courseList.map((c) => ({ value: String(c.id), label: c.title }))}
        />
        <AdminSelect
          name="tagId"
          defaultValue={String(tagList[0]?.id ?? "")}
          ariaLabel="태그 선택"
          size="sm"
          className="w-64"
          options={tagList.map((t) => ({
            value: String(t.id),
            label: `[${t.category}] ${t.code} (${t.name})`,
          }))}
        />
        <AdminInput name="weight" type="number" size="sm" min={1} max={10} defaultValue={3} className="w-20 font-mono" />
        <button type="submit" className={adminButtonClass({ variant: "solid", size: "md" })}>
          가중치 저장
        </button>
      </AdminActionForm>

      <div className="grid gap-3 md:grid-cols-3">
        {courseList.map((c) => {
          const attached = ctList
            .filter((ct) => ct.courseId === c.id)
            .map((ct) => ({
              weight: ct.weight,
              tag: tagList.find((t) => t.id === ct.tagId),
            }));
          return (
            <div key={c.id} className="rounded-panel bg-base-2 p-4 space-y-2 atlas-border">
              <p className="text-sm font-semibold">{c.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {attached.map((a, idx) => (
                  <span key={idx} className="rounded-badge bg-info/15 px-2 py-0.5 font-mono text-xs text-info">
                    {a.tag?.code} ×{a.weight}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
