import Link from "next/link";
import {
  and,
  auditLogs,
  count,
  desc,
  enrollments,
  eq,
  getDb,
  inArray,
  inquiries,
  orders,
  pointRecharges,
  sql,
  users,
} from "@repo/db";
import { formatDateTimeDot } from "@/00_lib/formatDate";
import { requireAdminSession } from "@/00_lib/session";
import { AdminPageHeader, AdminStatCard, AdminStatusBadge } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdminSession(["ADMIN"]);
  const db = getDb();

  const [
    [userCnt],
    [enrCnt],
    [pendingInqCnt],
    [rechargeSum],
    recentOrders,
    recentAudits,
  ] = await Promise.all([
    db.select({ c: count() }).from(users).where(eq(users.isDeleted, false)),
    db.select({ c: count() }).from(enrollments).where(eq(enrollments.isDeleted, false)),
    db
      .select({ c: count() })
      .from(inquiries)
      .where(and(inArray(inquiries.status, ["PENDING", "ASSIGNED"]), eq(inquiries.isDeleted, false))),
    db
      .select({ total: sql<string>`COALESCE(SUM(${pointRecharges.paidAmount}), 0)` })
      .from(pointRecharges)
      .where(and(eq(pointRecharges.status, "PAID"), eq(pointRecharges.isDeleted, false))),
    db
      .select()
      .from(orders)
      .where(eq(orders.isDeleted, false))
      .orderBy(desc(orders.id))
      .limit(6),
    db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(8),
  ]);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="운영 KPI 대시보드"
        description="PostgreSQL 18 실시간 집계 지표 및 최근 거래·감사 이벤트"
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard label="전체 보호자 회원" value={userCnt?.c ?? 0} sub="활성 계정 기준" tone="text-info" />
        <AdminStatCard label="누적 강좌 수강" value={enrCnt?.c ?? 0} sub="반려견 기준 Enrollment" tone="text-positive" />
        <AdminStatCard
          label="누적 충전 결제액"
          value={`${Number(rechargeSum?.total ?? 0).toLocaleString("ko-KR")}원`}
          sub="PortOne / IAP PAID 합계"
          tone="text-neutral"
        />
        <AdminStatCard
          label="답변 대기 영상 Q&A"
          value={pendingInqCnt?.c ?? 0}
          sub="48h SLA 모니터링 대상"
          tone={(pendingInqCnt?.c ?? 0) > 0 ? "text-warning" : "text-positive"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-panel bg-base-1 atlas-border">
          <div className="flex h-9 items-center justify-between gap-2 bg-base-2 px-4 atlas-border-b">
            <span className="truncate text-xs font-medium text-secondary">최근 포인트샵 주문</span>
            <Link href="/admin/orders" className="shrink-0 whitespace-nowrap text-xs text-info hover:underline">
              전체 보기
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-left">
              <tbody className="divide-y divide-hairline text-sm">
                {recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-[var(--mix-table-hover)]">
                    <td className="py-2.5 pl-4 pr-3 font-mono text-xs whitespace-nowrap text-secondary">{o.orderNo}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <AdminStatusBadge tone={o.status === "PAID" ? "info" : "neutral"}>
                        {o.status}
                      </AdminStatusBadge>
                    </td>
                    <td className="py-2.5 pl-3 pr-4 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                      {o.paidPoints.toLocaleString("ko-KR")} P
                    </td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-xs text-subdued">
                      주문 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-panel bg-base-1 atlas-border">
          <div className="flex h-9 items-center justify-between gap-2 bg-base-2 px-4 atlas-border-b">
            <span className="truncate text-xs font-medium text-secondary">최근 감사로그</span>
            <Link href="/admin/audit-logs" className="shrink-0 whitespace-nowrap text-xs text-info hover:underline">
              감사·복원 바로가기
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-left">
              <tbody className="divide-y divide-hairline text-sm">
                {recentAudits.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--mix-table-hover)]">
                    <td className="py-2.5 pl-4 pr-3 font-mono text-xs whitespace-nowrap text-neutral">{log.action}</td>
                    <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap text-secondary">
                      {log.entity ?? "-"}#{log.entityId ?? "-"}
                    </td>
                    <td className="py-2.5 pl-3 pr-4 text-right font-mono text-xs whitespace-nowrap tabular-nums text-subdued">
                      {formatDateTimeDot(log.createdAt)}
                    </td>
                  </tr>
                ))}
                {recentAudits.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-xs text-subdued">
                      기록된 감사로그가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
