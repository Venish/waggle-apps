import Link from "next/link";
import { desc, eq, getDb, trainers } from "@repo/db";
import { requireAdminSession } from "@/00_lib/session";
import { adminCreateTrainerAction } from "@/03_actions/admin/adminTrainerOpsActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminTrainersPage() {
  await requireAdminSession(["ADMIN"]);
  const db = getDb();
  const list = await db
    .select()
    .from(trainers)
    .where(eq(trainers.isDeleted, false))
    .orderBy(desc(trainers.id));

  async function addTrainer(formData: FormData) {
    "use server";
    return adminCreateTrainerAction({
      name: String(formData.get("name") ?? ""),
      bio: String(formData.get("bio") ?? ""),
      careerYears: Number(formData.get("careerYears") ?? 3),
    });
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="훈련사 프로필 관리"
        actions={
          <Link href="/admin/trainers/settlements" className="inline-flex h-7 items-center rounded-control bg-inverse px-2.5 text-control font-medium text-on-inverse">
            월 정산 관리
          </Link>
        }
      />

      <AdminActionForm
        action={addTrainer}
        errorTitle="훈련사 등록 실패"
        successMessage="훈련사 프로필이 등록되었습니다."
        resetOnSuccess
        className="grid gap-2 rounded-panel bg-base-2 p-3 sm:grid-cols-4 atlas-border"
      >
        <input name="name" placeholder="훈련사명" className="h-7 rounded-control bg-base-1 px-2.5 text-xs atlas-border" />
        <input name="bio" placeholder="약력 / 전문분야" className="h-7 sm:col-span-2 rounded-control bg-base-1 px-2.5 text-xs atlas-border" />
        <div className="flex gap-1.5">
          <input name="careerYears" type="number" defaultValue={5} className="h-7 w-16 rounded-control bg-base-1 px-2 font-mono text-xs atlas-border" />
          <button type="submit" className="h-7 flex-1 rounded-control bg-inverse px-2.5 text-xs font-medium text-on-inverse">
            등록
          </button>
        </div>
      </AdminActionForm>

      <div className="overflow-x-auto rounded-panel bg-base-1 atlas-border">
        <table className="w-full min-w-full text-left">
          <thead>
            <tr className="h-9 bg-base-2 text-xs text-secondary atlas-border-b">
              <th className="py-2 pl-4 pr-3">ID</th>
              <th className="px-3 py-2">이름</th>
              <th className="px-3 py-2">소개</th>
              <th className="px-3 py-2 text-right">경력</th>
              <th className="py-2 pl-3 pr-4 text-right">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline text-sm">
            {list.map((t) => (
              <tr key={t.id}>
                <td className="py-2.5 pl-4 pr-3 font-mono text-xs text-secondary">#{t.id}</td>
                <td className="px-3 py-2.5 font-medium">{t.name}</td>
                <td className="px-3 py-2.5 text-xs text-secondary">{t.bio ?? "-"}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">{t.careerYears ?? 0}년</td>
                <td className="py-2.5 pl-3 pr-4 text-right">
                  <AdminStatusBadge tone={t.isActive ? "positive" : "neutral"}>
                    {t.isActive ? "ACTIVE" : "INACTIVE"}
                  </AdminStatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
