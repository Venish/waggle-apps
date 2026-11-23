import { notFound } from "next/navigation";
import { admins, eq, getDb } from "@repo/db";
import { formatDateTimeDot } from "@/00_lib/formatDate";
import { requireAdminSession } from "@/00_lib/session";
import { updateAdminStatusAction } from "@/03_actions/admin/adminAuthActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession(["ADMIN"]);
  const { id } = await params;
  const adminId = Number(id);
  if (!Number.isInteger(adminId)) notFound();

  const db = getDb();
  const [admin] = await db.select().from(admins).where(eq(admins.id, adminId)).limit(1);
  if (!admin) notFound();

  async function unlockAccount() {
    "use server";
    return updateAdminStatusAction({ adminId, status: "ACTIVE", unlock: true });
  }
  async function deactivateAccount() {
    "use server";
    return updateAdminStatusAction({ adminId, status: "INACTIVE" });
  }

  return (
    <div className="max-w-xl space-y-4">
      <AdminPageHeader title={`관리자 상세 #${admin.id}`} description={admin.email} />

      <div className="rounded-panel bg-base-2 p-5 space-y-3 atlas-border">
        <div className="flex items-center gap-2">
          <AdminStatusBadge tone="info">{admin.role}</AdminStatusBadge>
          <AdminStatusBadge tone={admin.status === "ACTIVE" ? "positive" : "negative"}>
            {admin.status}
          </AdminStatusBadge>
        </div>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-subdued">이름</dt>
            <dd className="font-medium">{admin.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-subdued">연락처</dt>
            <dd className="font-mono text-xs">{admin.phone}</dd>
          </div>
          <div>
            <dt className="text-xs text-subdued">로그인 오답 횟수</dt>
            <dd className="font-mono text-xs tabular-nums">{admin.failedLoginCount} / 5</dd>
          </div>
          <div>
            <dt className="text-xs text-subdued">최근 로그인</dt>
            <dd className="font-mono text-xs tabular-nums">
              {formatDateTimeDot(admin.lastLoginAt)}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2 pt-3 atlas-border-t">
          <AdminActionForm action={unlockAccount} successMessage="계정이 활성화(잠금 해제)되었습니다.">
            <button type="submit" className="h-7 rounded-control bg-inverse px-3 text-control font-medium text-on-inverse">
              활성화 / 잠금 해제
            </button>
          </AdminActionForm>
          <AdminActionForm
            action={deactivateAccount}
            confirmTitle="관리자 계정을 비활성화할까요?"
            confirmDescription="해당 관리자의 활성 세션이 즉시 폐기됩니다."
            confirmLabel="비활성화"
            successMessage="계정이 비활성화되었습니다."
          >
            <button type="submit" className="h-7 rounded-control px-3 text-control font-medium text-negative atlas-border">
              비활성화 (세션 즉시 폐기)
            </button>
          </AdminActionForm>
        </div>
      </div>
    </div>
  );
}
