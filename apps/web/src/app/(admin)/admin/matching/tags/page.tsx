import Link from "next/link";
import { asc, eq, getDb, tags } from "@repo/db";
import { requireAdminSession } from "@/00_lib/session";
import { adminCreateTagAction } from "@/03_actions/admin/adminEducationMatchingActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import {
  adminButtonClass,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
  AdminStatusBadge,
} from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminMatchingTagsPage() {
  await requireAdminSession(["ADMIN"]);
  const db = getDb();
  const list = await db
    .select()
    .from(tags)
    .where(eq(tags.isDeleted, false))
    .orderBy(asc(tags.category), asc(tags.code));

  async function addTag(formData: FormData) {
    "use server";
    return adminCreateTagAction({
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      category: String(formData.get("category") ?? "ETC") as typeof tags.$inferInsert.category,
    });
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="매칭 태그 마스터"
        actions={
          <Link href="/admin/matching" className="inline-flex h-7 items-center rounded-control px-2.5 text-control atlas-border">
            매칭 개요
          </Link>
        }
      />

      <AdminActionForm
        action={addTag}
        errorTitle="태그 추가 실패"
        successMessage="매칭 태그가 추가되었습니다."
        resetOnSuccess
        className="flex flex-wrap gap-2 rounded-panel bg-base-2 p-3 atlas-border"
      >
        <AdminInput name="code" size="sm" placeholder="태그 코드 (예: prob_jump)" className="w-48 font-mono" />
        <AdminInput name="name" size="sm" placeholder="표시 이름" className="w-44" />
        <AdminSelect
          name="category"
          defaultValue="AGE"
          ariaLabel="태그 카테고리"
          size="sm"
          className="w-36"
          options={["AGE", "EXPERIENCE", "PROBLEM", "GOAL", "ENV", "SOCIAL", "SPECIALTY", "ETC"].map((c) => ({
            value: c,
            label: c,
          }))}
        />
        <button type="submit" className={adminButtonClass({ variant: "solid", size: "md" })}>
          태그 추가
        </button>
      </AdminActionForm>

      <div className="overflow-x-auto rounded-panel bg-base-1 atlas-border">
        <table className="w-full min-w-full text-left">
          <thead>
            <tr className="h-9 bg-base-2 text-xs text-secondary atlas-border-b">
              <th className="py-2 pl-4 pr-3">카테고리</th>
              <th className="px-3 py-2">코드</th>
              <th className="py-2 pl-3 pr-4">이름</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline text-xs">
            {list.map((t) => (
              <tr key={t.id}>
                <td className="py-2 pl-4 pr-3"><AdminStatusBadge tone="info">{t.category}</AdminStatusBadge></td>
                <td className="px-3 py-2 font-mono">{t.code}</td>
                <td className="py-2 pl-3 pr-4 font-medium">{t.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
