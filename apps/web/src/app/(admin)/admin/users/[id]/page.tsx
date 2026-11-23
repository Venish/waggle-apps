import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, dogs, eq, getDb, pointLedgers, pointRecharges, pointWallets, users } from "@repo/db";
import { formatDateTimeDot } from "@/00_lib/formatDate";
import { requireAdminSession } from "@/00_lib/session";
import {
  adminAdjustUserPointsAction,
  adminForceRevokeUserSessionAction,
  adminUpdateUserStatusAction,
} from "@/03_actions/admin/adminUserCodeActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession(["ADMIN"]);
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) notFound();

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) notFound();

  const [myDogs, [wallet], ledgers, recentRecharges] = await Promise.all([
    db.select().from(dogs).where(and(eq(dogs.userId, user.id), eq(dogs.isDeleted, false))),
    db.select().from(pointWallets).where(eq(pointWallets.userId, user.id)).limit(1),
    db
      .select()
      .from(pointLedgers)
      .where(eq(pointLedgers.userId, user.id))
      .orderBy(desc(pointLedgers.id))
      .limit(20),
    db
      .select()
      .from(pointRecharges)
      .where(and(eq(pointRecharges.userId, user.id), eq(pointRecharges.isDeleted, false)))
      .orderBy(desc(pointRecharges.id))
      .limit(5),
  ]);

  async function toggleStatus() {
    "use server";
    return adminUpdateUserStatusAction({
      userId,
      status: user!.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
    });
  }

  async function forceLogout() {
    "use server";
    return adminForceRevokeUserSessionAction(userId);
  }

  async function adjustPoints(formData: FormData) {
    "use server";
    return adminAdjustUserPointsAction({
      userId,
      mode: formData.get("mode") === "REVOKE" ? "REVOKE" : "GRANT",
      amount: Number(formData.get("amount") ?? 0),
      memo: String(formData.get("memo") ?? "").trim(),
    });
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title={`회원 상세: ${user.nickname} (#${user.id})`}
        description="반려견 프로필 · 포인트 수동 조정 · 세션 강제 종료"
        actions={
          <>
            <AdminActionForm
              action={forceLogout}
              confirmTitle="세션을 강제 종료할까요?"
              confirmDescription="해당 회원의 활성 기기 세션이 즉시 만료됩니다."
              confirmLabel="강제 종료"
              successMessage="회원의 활성 세션을 모두 종료했습니다."
            >
              <button type="submit" className="h-7 whitespace-nowrap rounded-control px-2.5 text-control font-medium text-warning atlas-border">
                세션 강제 종료
              </button>
            </AdminActionForm>
            <AdminActionForm
              action={toggleStatus}
              confirmTitle={user.status === "ACTIVE" ? "계정을 정지할까요?" : "계정 정지를 해제할까요?"}
              confirmDescription={
                user.status === "ACTIVE"
                  ? "정지 시 회원의 활성 세션이 즉시 폐기됩니다."
                  : "회원이 다시 정상 로그인할 수 있습니다."
              }
              confirmLabel={user.status === "ACTIVE" ? "계정 정지" : "정지 해제"}
              confirmTone={user.status === "ACTIVE" ? "negative" : "default"}
              successMessage={user.status === "ACTIVE" ? "계정이 정지되었습니다." : "계정 정지가 해제되었습니다."}
            >
              <button type="submit" className="h-7 whitespace-nowrap rounded-control px-2.5 text-control font-medium text-negative atlas-border">
                {user.status === "ACTIVE" ? "계정 정지" : "정지 해제"}
              </button>
            </AdminActionForm>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-panel bg-base-2 p-4 space-y-2 atlas-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-secondary">회원 정보</span>
            <AdminStatusBadge tone={user.status === "ACTIVE" ? "positive" : "negative"}>
              {user.status}
            </AdminStatusBadge>
          </div>
          <p className="text-lg font-semibold tabular-nums">
            {(wallet?.balance ?? 0).toLocaleString("ko-KR")} P
          </p>
          <p className="text-xs text-subdued">
            연락처: {user.phone ?? "-"} · 지역: {user.region ?? "-"}
          </p>
          <div className="pt-2 atlas-border-t">
            <p className="text-xs font-medium text-secondary">등록 반려견 ({myDogs.length})</p>
            <ul className="mt-1 space-y-1 text-xs">
              {myDogs.map((d) => (
                <li key={d.id}>
                  • {d.name} ({d.sizeClass} · {d.grade}학년){d.isPrimary ? " [대표견]" : ""}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <AdminActionForm
          action={adjustPoints}
          errorTitle="포인트 조정 실패"
          successMessage="포인트 원장이 정상 반영되었습니다."
          resetOnSuccess
          className="lg:col-span-2 rounded-panel bg-base-2 p-4 space-y-3 atlas-border"
        >
          <h3 className="text-sm font-semibold">포인트 수동 지급 / 회수 (ACID 원장 반영)</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <select name="mode" className="h-7 rounded-control bg-base-1 px-2.5 text-control atlas-border">
              <option value="GRANT">수동 지급 (+)</option>
              <option value="REVOKE">수동 회수 (-)</option>
            </select>
            <input name="amount" type="number" min={1} placeholder="포인트 금액" className="h-7 rounded-control bg-base-1 px-2.5 font-mono text-sm tabular-nums atlas-border" />
            <input name="memo" type="text" placeholder="조정 사유 (필수)" className="h-7 rounded-control bg-base-1 px-2.5 text-sm atlas-border" />
          </div>
          <button type="submit" className="h-7 rounded-control bg-inverse px-3 text-control font-medium text-on-inverse">
            원장 반영 실행
          </button>
        </AdminActionForm>
      </div>

      <section className="overflow-hidden rounded-panel bg-base-1 atlas-border">
        <div className="flex h-9 items-center justify-between bg-base-2 px-4 text-xs font-medium text-secondary atlas-border-b">
          <span>최근 포인트 충전 결제 ({recentRecharges.length})</span>
          <Link
            href={`/admin/recharges?userId=${user.id}`}
            className="text-xs font-semibold text-neutral underline-offset-2 hover:underline"
          >
            충전 · 환불 관리에서 전체 보기
          </Link>
        </div>
        {recentRecharges.length === 0 ? (
          <p className="p-4 text-xs text-subdued">충전 결제 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-left">
              <tbody className="divide-y divide-hairline text-xs">
                {recentRecharges.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pl-4 pr-3 font-mono whitespace-nowrap text-subdued">
                      #{r.id}
                    </td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap text-secondary">
                      {r.channel} · {r.packageCode ?? "-"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <AdminStatusBadge
                        tone={
                          r.status === "PAID"
                            ? "positive"
                            : r.status === "REFUND_REQUESTED"
                              ? "warning"
                              : "negative"
                        }
                      >
                        {r.status}
                      </AdminStatusBadge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums">
                      {r.paidAmount.toLocaleString("ko-KR")}원 ({r.pointAmount.toLocaleString("ko-KR")} P)
                    </td>
                    <td className="py-2 pl-3 pr-4 text-right font-mono whitespace-nowrap tabular-nums text-subdued">
                      {formatDateTimeDot(r.paidAt ?? r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-panel bg-base-1 atlas-border">
        <div className="flex h-9 items-center bg-base-2 px-4 text-xs font-medium text-secondary atlas-border-b">
          최근 포인트 원장 ({ledgers.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-full text-left">
            <tbody className="divide-y divide-hairline text-sm">
              {ledgers.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 pl-4 pr-3 font-mono text-xs whitespace-nowrap text-secondary">{l.reason}</td>
                  <td className="px-3 py-2 text-xs min-w-36">{l.memo ?? "-"}</td>
                  <td className={`px-3 py-2 text-right font-mono text-xs whitespace-nowrap tabular-nums ${l.delta >= 0 ? "text-positive" : "text-negative"}`}>
                    {l.delta >= 0 ? "+" : ""}
                    {l.delta.toLocaleString("ko-KR")} P
                  </td>
                  <td className="py-2 pl-3 pr-4 text-right font-mono text-xs whitespace-nowrap tabular-nums text-subdued">
                    잔액 {l.balanceAfter.toLocaleString("ko-KR")} P
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
