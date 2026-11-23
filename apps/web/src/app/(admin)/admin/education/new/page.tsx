import { requireAdminSession } from "@/00_lib/session";
import { adminUpsertCourseAction } from "@/03_actions/admin/adminEducationMatchingActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminEducationNewPage() {
  await requireAdminSession(["ADMIN"]);

  async function createCourse(formData: FormData) {
    "use server";
    return adminUpsertCourseAction({
      code: String(formData.get("code") ?? ""),
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      level: Number(formData.get("level") ?? 1),
      isPremium: formData.get("isPremium") === "on",
      isPublished: formData.get("isPublished") === "on",
      sortOrder: Number(formData.get("sortOrder") ?? 10),
    });
  }

  return (
    <div className="max-w-xl space-y-4">
      <AdminPageHeader title="신규 강좌 생성" />
      <AdminActionForm
        action={createCourse}
        errorTitle="강좌 생성 실패"
        successMessage="신규 강좌가 생성되었습니다."
        redirectIdPrefix="/admin/education"
        className="space-y-3 rounded-panel bg-base-2 p-5 atlas-border"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-secondary">강좌 코드 *</label>
            <input name="code" placeholder="COURSE_NEW_101" className="mt-1 h-7 w-full rounded-control bg-base-1 px-2.5 font-mono text-xs atlas-border" />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary">난이도 레벨 (1~5)</label>
            <input name="level" type="number" min={1} max={5} defaultValue={1} className="mt-1 h-7 w-full rounded-control bg-base-1 px-2.5 font-mono text-xs atlas-border" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary">강좌명 *</label>
          <input name="title" className="mt-1 h-7 w-full rounded-control bg-base-1 px-2.5 text-sm atlas-border" />
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary">설명</label>
          <textarea name="description" rows={3} className="mt-1 w-full rounded-control bg-base-1 p-2.5 text-sm atlas-border" />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="isPremium" /> 프리미엄 강좌 (CourseUnlock 필요)
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="isPublished" defaultChecked /> 즉시 게시
          </label>
        </div>
        <button type="submit" className="h-7 rounded-control bg-inverse px-3 text-control font-medium text-on-inverse">
          강좌 생성 후 챕터 편집
        </button>
      </AdminActionForm>
    </div>
  );
}
