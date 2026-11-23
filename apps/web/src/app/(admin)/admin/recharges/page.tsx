import Link from "next/link";
import { and, desc, eq, getDb, pointLedgers, pointRecharges, pointWallets, users } from "@repo/db";
import { formatDateTimeDot } from "@/00_lib/formatDate";
import { requireAdminSession } from "@/00_lib/session";
import {
  adminApproveRechargeRefundAction,
  adminRejectRechargeRefundAction,
} from "@/03_actions/admin/adminCommerceActions";
import { computeRechargeRefundMeta } from "@/04_services/shared/commerceRefundService";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

type RechargeFilterTab = "ALL" | "REFUND_REQUESTED" | "PAID" | "REFUNDED";

const STATUS_TONE: Record<string, "positive" | "negative" | "warning" | "info" | "neutral"> = {
  PENDING: "neutral",
  PAID: "positive",
  REFUND_REQUESTED: "warning",
  REFUNDED: "negative",
  CANCELLED: "neutral",
  FAILED: "negative",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "결제대기",
  PAID: "결제완료",
  REFUND_REQUESTED: "환불요청",
  REFUNDED: "환불완료",
  CANCELLED: "취소됨",
  FAILED: "실패",
};

export default async function AdminRechargesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; userId?: string }>;
}) {
  await requireAdminSession(["ADMIN"]);
  const { tab = "ALL", userId: userIdRaw } = await searchParams;
  const activeTab = (
    ["ALL", "REFUND_REQUESTED", "PAID", "REFUNDED"].includes(tab) ? tab : "ALL"
  ) as RechargeFilterTab;
  const filterUserId = userIdRaw && Number.isInteger(Number(userIdRaw)) ? Number(userIdRaw) : null;

  const db = getDb();
  const [rechargeRows, userRows, walletRows, earnLedgers] = await Promise.all([
    db
      .select()
      .from(pointRecharges)
      .where(
        filterUserId
          ? and(eq(pointRecharges.userId, filterUserId), eq(pointRecharges.isDeleted, false))
          : eq(pointRecharges.isDeleted, false),
      )
      .orderBy(desc(pointRecharges.id))
      .limit(100),
    db.select({ id: users.id, nickname: users.nickname, phone: users.phone }).from(users),
    db
      .select({ userId: pointWallets.userId, balance: pointWallets.balance })
      .from(pointWallets)
      .where(eq(pointWallets.isDeleted, false)),
    db
      .select({ refId: pointLedgers.refId, remainingAmount: pointLedgers.remainingAmount })
      .from(pointLedgers)
      .where(
        and(eq(pointLedgers.reason, "EARN_RECHARGE"), eq(pointLedgers.refType, "recharge")),
      ),
  ]);

  const userMap = new Map(userRows.map((u) => [u.id, u]));
  const walletMap = new Map(walletRows.map((w) => [w.userId, w.balance]));
  const remainingMap = new Map<number, number>();
  for (const l of earnLedgers) {
    if (l.refId !== null) remainingMap.set(l.refId, l.remainingAmount ?? 0);
  }

  const requestedCount = rechargeRows.filter((r) => r.status === "REFUND_REQUESTED").length;
  const filtered = rechargeRows.filter((r) => {
    if (activeTab === "ALL") return true;
    return r.status === activeTab;
  });

  const buildTabHref = (nextTab: RechargeFilterTab) => {
    const qs = new URLSearchParams();
    if (nextTab !== "ALL") qs.set("tab", nextTab);
    if (filterUserId) qs.set("userId", String(filterUserId));
    const q = qs.toString();
    return q ? `/admin/recharges?${q}` : "/admin/recharges";
  };

  const tabs: Array<{ key: RechargeFilterTab; label: string }> = [
    { key: "ALL", label: `전체 (${rechargeRows.length})` },
    { key: "REFUND_REQUESTED", label: `환불 요청 (${requestedCount})` },
    { key: "PAID", label: "결제완료" },
    { key: "REFUNDED", label: "환불완료" },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="포인트 충전 · 환불 관리"
        description="PG/IAP 충전 결제 내역 조회 및 GM-103 잔여 충전분 비례 환불 승인·반려"
        actions={
          filterUserId ? (
            <Link
              href="/admin/recharges"
              className="inline-flex h-7 items-center rounded-control bg-base-2 px-2.5 text-xs font-medium text-secondary hover:text-neutral atlas-border"
            >
              회원 #{filterUserId} 필터 해제
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <Link
              key={t.key}
              href={buildTabHref(t.key)}
              className={`inline-flex h-7 items-center rounded-control px-2.5 text-xs font-medium transition-colors atlas-border ${
                active
                  ? "bg-inverse text-on-inverse"
                  : t.key === "REFUND_REQUESTED" && requestedCount > 0
                    ? "bg-base-2 text-warning hover:bg-base-3"
                    : "bg-base-2 text-secondary hover:text-neutral"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="space-y-3">
        {filtered.map((rec) => {
          const user = userMap.get(rec.userId);
          const walletBalance = walletMap.get(rec.userId) ?? 0;
          const remainingAmount = remainingMap.get(rec.id) ?? 0;
          const meta = computeRechargeRefundMeta({
            status: "PAID",
            channel: rec.channel,
            pointAmount: rec.pointAmount,
            paidAmount: rec.paidAmount,
            paidAt: rec.paidAt ?? rec.createdAt,
            remainingAmount,
            walletBalance,
          });
          const canApprove =
            (rec.status === "REFUND_REQUESTED" || rec.status === "PAID") &&
            meta.refundablePoints > 0;

          async function approveRefund() {
            "use server";
            return adminApproveRechargeRefundAction(rec.id);
          }

          async function rejectRefund(formData: FormData) {
            "use server";
            return adminRejectRechargeRefundAction({
              rechargeId: rec.id,
              rejectReason: String(formData.get("rejectReason") ?? ""),
            });
          }

          return (
            <div key={rec.id} className="rounded-panel bg-base-2 p-4 space-y-3 atlas-border">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-neutral">#{rec.id}</span>
                  <AdminStatusBadge tone={STATUS_TONE[rec.status] ?? "neutral"}>
                    {STATUS_LABEL[rec.status] ?? rec.status}
                  </AdminStatusBadge>
                  <span className="font-mono text-xs text-secondary">
                    {rec.channel} · {rec.packageCode ?? "-"}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-subdued">
                    {formatDateTimeDot(rec.paidAt ?? rec.createdAt)}
                  </span>
                </div>
                <div className="text-xs text-subdued">
                  <Link
                    href={`/admin/users/${rec.userId}`}
                    className="font-medium text-neutral underline-offset-2 hover:underline"
                  >
                    {user?.nickname ?? `회원 #${rec.userId}`} ({user?.phone ?? "-"})
                  </Link>
                  {" · "}현재 지갑 잔액{" "}
                  <span className="font-mono font-semibold tabular-nums text-neutral">
                    {walletBalance.toLocaleString("ko-KR")} P
                  </span>
                </div>
              </div>

              <div className="grid gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-control bg-base-1 px-3 py-2 atlas-border">
                  <span className="text-subdued">결제 금액 / 충전 포인트</span>
                  <p className="mt-0.5 font-mono font-semibold tabular-nums text-neutral">
                    {rec.paidAmount.toLocaleString("ko-KR")}원 ·{" "}
                    {rec.pointAmount.toLocaleString("ko-KR")} P
                  </p>
                </div>
                <div className="rounded-control bg-base-1 px-3 py-2 atlas-border">
                  <span className="text-subdued">사용 / 잔여 충전 포인트</span>
                  <p className="mt-0.5 font-mono font-semibold tabular-nums text-neutral">
                    사용 {meta.usedPoints.toLocaleString("ko-KR")} P · 잔여{" "}
                    {meta.remainingPoints.toLocaleString("ko-KR")} P
                  </p>
                </div>
                <div className="rounded-control bg-base-1 px-3 py-2 atlas-border">
                  <span className="text-subdued">
                    {rec.status === "REFUNDED" ? "실제 환불 완료" : "GM-103 환불 가능액"}
                  </span>
                  <p className="mt-0.5 font-mono font-semibold tabular-nums text-neutral">
                    {rec.status === "REFUNDED"
                      ? `${(rec.refundedCashAmount ?? rec.paidAmount).toLocaleString("ko-KR")}원 (${(rec.refundedPointAmount ?? rec.pointAmount).toLocaleString("ko-KR")} P 회수)`
                      : `${meta.refundableCash.toLocaleString("ko-KR")}원 (${meta.refundablePoints.toLocaleString("ko-KR")} P 회수)`}
                  </p>
                </div>
              </div>

              {rec.refundReason && (
                <div className="rounded-control bg-base-1 px-3 py-2 text-xs text-secondary atlas-border">
                  <span className="font-semibold text-warning">사유:</span> {rec.refundReason}
                  {rec.refundedAt && (
                    <span className="ml-2 font-mono text-subdued">
                      ({formatDateTimeDot(rec.refundedAt)})
                    </span>
                  )}
                </div>
              )}

              {rec.adminRejectReason && (
                <div className="rounded-control bg-base-1 px-3 py-2 text-xs text-negative atlas-border">
                  <span className="font-semibold">관리자 반려 사유:</span> {rec.adminRejectReason}
                </div>
              )}

              {(rec.status === "REFUND_REQUESTED" || canApprove) && (
                <div className="flex flex-wrap items-center gap-2 pt-1 atlas-border-t">
                  {canApprove && (
                    <AdminActionForm
                      action={approveRefund}
                      confirmTitle="충전 포인트 환불을 승인할까요?"
                      confirmDescription={`충전 #${rec.id}의 잔여 ${meta.refundablePoints.toLocaleString("ko-KR")}P를 회수하고 ${meta.refundableCash.toLocaleString("ko-KR")}원 환불 완료 처리합니다.`}
                      confirmLabel="환불 승인 실행"
                      errorTitle="환불 승인 실패"
                      successMessage="충전 환불 및 포인트 원장 회수가 완료되었습니다."
                    >
                      <button
                        type="submit"
                        className={`h-7 shrink-0 whitespace-nowrap rounded-control px-2.5 text-xs font-medium ${
                          rec.status === "REFUND_REQUESTED"
                            ? "bg-inverse text-on-inverse"
                            : "text-negative atlas-border"
                        }`}
                      >
                        {rec.status === "REFUND_REQUESTED"
                          ? `환불 승인 (${meta.refundableCash.toLocaleString("ko-KR")}원)`
                          : `관리자 환불 (${meta.refundableCash.toLocaleString("ko-KR")}원)`}
                      </button>
                    </AdminActionForm>
                  )}

                  {rec.status === "REFUND_REQUESTED" && (
                    <AdminActionForm
                      action={rejectRefund}
                      errorTitle="반려 처리 실패"
                      successMessage="환불 신청이 반려되고 회원에게 알림이 발송되었습니다."
                      resetOnSuccess
                      className="flex flex-1 flex-wrap items-center gap-1.5 min-w-56"
                    >
                      <input
                        name="rejectReason"
                        placeholder="반려 사유 입력 (예: 무상 적립 포인트만 잔존)"
                        className="h-7 min-w-0 flex-1 rounded-control bg-base-1 px-2 text-xs atlas-border"
                      />
                      <button
                        type="submit"
                        className="h-7 shrink-0 whitespace-nowrap rounded-control px-2.5 text-xs font-medium text-negative atlas-border"
                      >
                        환불 반려
                      </button>
                    </AdminActionForm>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-panel bg-base-2 p-8 text-center text-xs text-subdued atlas-border">
            해당 조건의 충전 결제 내역이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
