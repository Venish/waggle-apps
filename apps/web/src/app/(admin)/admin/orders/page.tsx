import Link from "next/link";
import { desc, eq, getDb, orders, shipments } from "@repo/db";
import { formatDateTimeDot } from "@/00_lib/formatDate";
import { requireAdminSession } from "@/00_lib/session";
import {
  adminCancelOrderRefundAction,
  adminRejectOrderRequestAction,
  adminUpdateOrderShipmentAction,
} from "@/03_actions/admin/adminCommerceActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import {
  adminButtonClass,
  AdminEmptyState,
  AdminInput,
  AdminPageHeader,
  AdminSelect,
  AdminStatusBadge,
} from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

type OrderFilterTab = "ALL" | "CLAIMS" | "PAID" | "PREPARING" | "SHIPPING" | "CLOSED";

const STATUS_BADGE_TONE: Record<string, "positive" | "negative" | "warning" | "info" | "neutral"> = {
  PAID: "info",
  PREPARING: "info",
  SHIPPING: "info",
  DELIVERED: "positive",
  CONFIRMED: "positive",
  CANCEL_REQUESTED: "warning",
  RETURN_REQUESTED: "warning",
  CANCELLED: "negative",
  REFUNDED: "negative",
  FAILED: "negative",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "결제대기",
  PAID: "결제완료",
  PREPARING: "배송준비",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
  CONFIRMED: "구매확정",
  CANCEL_REQUESTED: "취소요청",
  RETURN_REQUESTED: "반품요청",
  CANCELLED: "취소완료",
  REFUNDED: "환불완료",
  FAILED: "실패",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdminSession(["ADMIN"]);
  const { tab = "ALL" } = await searchParams;
  const activeTab = (
    ["ALL", "CLAIMS", "PAID", "PREPARING", "SHIPPING", "CLOSED"].includes(tab) ? tab : "ALL"
  ) as OrderFilterTab;

  const db = getDb();
  const [orderList, shipList] = await Promise.all([
    db.select().from(orders).where(eq(orders.isDeleted, false)).orderBy(desc(orders.id)).limit(80),
    db.select().from(shipments).where(eq(shipments.isDeleted, false)),
  ]);
  const shipMap = new Map(shipList.map((s) => [s.orderId, s]));

  const claimCount = orderList.filter(
    (o) => o.status === "CANCEL_REQUESTED" || o.status === "RETURN_REQUESTED",
  ).length;

  const filtered = orderList.filter((o) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "CLAIMS") {
      return o.status === "CANCEL_REQUESTED" || o.status === "RETURN_REQUESTED";
    }
    if (activeTab === "CLOSED") {
      return (
        o.status === "DELIVERED" ||
        o.status === "CONFIRMED" ||
        o.status === "CANCELLED" ||
        o.status === "REFUNDED"
      );
    }
    return o.status === activeTab;
  });

  const tabs: Array<{ key: OrderFilterTab; label: string }> = [
    { key: "ALL", label: `전체 (${orderList.length})` },
    { key: "CLAIMS", label: `취소·반품 요청 (${claimCount})` },
    { key: "PAID", label: "결제완료" },
    { key: "PREPARING", label: "배송준비" },
    { key: "SHIPPING", label: "배송중" },
    { key: "CLOSED", label: "완료·환불" },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="주문 · 배송 관리"
        description="배송지 확인 · 송장번호 입력 · 사용자 취소/반품 신청 승인·반려 및 재고 복구 환불"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <Link
              key={t.key}
              href={t.key === "ALL" ? "/admin/orders" : `/admin/orders?tab=${t.key}`}
              className={adminButtonClass({
                variant: active ? "solid" : "outline",
                size: "sm",
                className: !active && t.key === "CLAIMS" && claimCount > 0 ? "text-warning" : undefined,
              })}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="space-y-3">
        {filtered.map((ord) => {
          const ship = shipMap.get(ord.id);
          const isClaim =
            ord.status === "CANCEL_REQUESTED" || ord.status === "RETURN_REQUESTED";
          const isClosed =
            ord.status === "CONFIRMED" || ord.status === "CANCELLED" || ord.status === "REFUNDED";

          async function updateShipment(formData: FormData) {
            "use server";
            return adminUpdateOrderShipmentAction({
              orderId: ord.id,
              status: String(formData.get("status") ?? "SHIPPING") as
                | "PREPARING"
                | "SHIPPING"
                | "DELIVERED",
              courier: String(formData.get("courier") ?? ""),
              trackingNo: String(formData.get("trackingNo") ?? ""),
            });
          }
          async function refundOrder(formData: FormData) {
            "use server";
            const restoreStock = formData.get("restoreStock") !== "false";
            return adminCancelOrderRefundAction(ord.id, { restoreStock });
          }
          async function rejectRequest(formData: FormData) {
            "use server";
            return adminRejectOrderRequestAction({
              orderId: ord.id,
              rejectReason: String(formData.get("rejectReason") ?? ""),
            });
          }

          return (
            <div key={ord.id} className="rounded-panel bg-base-2 p-4 space-y-3 atlas-border">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-neutral">{ord.orderNo}</span>
                  <AdminStatusBadge tone={STATUS_BADGE_TONE[ord.status] ?? "neutral"}>
                    {STATUS_LABEL[ord.status] ?? ord.status}
                  </AdminStatusBadge>
                  <span className="font-mono text-xs tabular-nums text-secondary">
                    {ord.paidPoints.toLocaleString("ko-KR")} P
                  </span>
                  <span className="font-mono text-xs tabular-nums text-subdued">
                    {formatDateTimeDot(ord.createdAt)}
                  </span>
                </div>
                <div className="text-xs text-subdued">
                  <Link
                    href={`/admin/users/${ord.userId}`}
                    className="font-medium text-neutral underline-offset-2 hover:underline"
                  >
                    회원 #{ord.userId}
                  </Link>
                  {" · "}
                  수령인: {ord.addressSnapshot.receiver} ({ord.addressSnapshot.phone}) · [
                  {ord.addressSnapshot.zipcode}] {ord.addressSnapshot.addr1}
                  {ord.addressSnapshot.addr2 ? ` ${ord.addressSnapshot.addr2}` : ""}
                </div>
              </div>

              {ord.cancelReason && (
                <div className="rounded-control bg-base-1 px-3 py-2 text-xs text-secondary atlas-border">
                  <span className="font-semibold text-warning">사용자 사유:</span> {ord.cancelReason}
                </div>
              )}

              {ord.adminRejectReason && (
                <div className="rounded-control bg-base-1 px-3 py-2 text-xs text-negative atlas-border">
                  <span className="font-semibold">관리자 반려 사유:</span> {ord.adminRejectReason}
                </div>
              )}

              {isClaim && (
                <div className="flex flex-wrap items-center gap-2 pt-1 atlas-border-t">
                  <AdminActionForm
                    action={refundOrder}
                    confirmTitle="취소·반품 요청을 승인하고 환불할까요?"
                    confirmDescription={`주문 ${ord.orderNo}의 결제 포인트(${ord.paidPoints.toLocaleString("ko-KR")} P)가 회원에게 환불되며 재고가 복구됩니다.`}
                    confirmLabel="승인 · 환불 실행"
                    errorTitle="승인 처리 실패"
                    successMessage="취소·반품 승인 및 포인트 환불이 완료되었습니다."
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="restoreStock" value="true" />
                    <button
                      type="submit"
                      className={adminButtonClass({ variant: "solid", size: "sm" })}
                    >
                      요청 승인 · 환불 (재고복구)
                    </button>
                  </AdminActionForm>

                  <AdminActionForm
                    action={rejectRequest}
                    errorTitle="반려 처리 실패"
                    successMessage="요청이 반려되고 회원에게 알림이 발송되었습니다."
                    resetOnSuccess
                    className="flex flex-1 flex-wrap items-center gap-1.5 min-w-56"
                  >
                    <AdminInput
                      name="rejectReason"
                      size="sm"
                      placeholder="반려 사유 입력 (예: 이미 출고 완료)"
                      className="flex-1"
                    />
                    <button
                      type="submit"
                      className={adminButtonClass({ variant: "danger", size: "sm" })}
                    >
                      요청 반려
                    </button>
                  </AdminActionForm>
                </div>
              )}

              {!isClosed && !isClaim && (
                <div className="flex flex-wrap items-center gap-2">
                  <AdminActionForm
                    action={updateShipment}
                    errorTitle="배송 반영 실패"
                    successMessage="주문 배송 상태가 반영되었습니다."
                    className="flex flex-wrap items-center gap-2 w-full sm:w-auto"
                  >
                    <AdminSelect
                      name="status"
                      defaultValue={ord.status === "PAID" ? "PREPARING" : ord.status}
                      ariaLabel="배송 상태"
                      size="sm"
                      className="w-44"
                      options={[
                        { value: "PREPARING", label: "PREPARING (배송준비)" },
                        { value: "SHIPPING", label: "SHIPPING (배송중)" },
                        { value: "DELIVERED", label: "DELIVERED (배송완료)" },
                      ]}
                    />
                    <AdminInput
                      name="courier"
                      size="sm"
                      defaultValue={ship?.courier ?? "CJ대한통운"}
                      placeholder="택배사"
                      className="flex-1 sm:w-28 sm:flex-none"
                    />
                    <AdminInput
                      name="trackingNo"
                      size="sm"
                      defaultValue={ship?.trackingNo ?? ""}
                      placeholder="송장번호"
                      className="flex-1 font-mono sm:w-40 sm:flex-none"
                    />
                    <button
                      type="submit"
                      className={adminButtonClass({ variant: "solid", size: "md" })}
                    >
                      배송 반영
                    </button>
                  </AdminActionForm>

                  <AdminActionForm
                    action={refundOrder}
                    confirmTitle="주문을 취소하고 전액 환불할까요?"
                    confirmDescription={`주문 ${ord.orderNo}의 결제 포인트(${ord.paidPoints.toLocaleString("ko-KR")} P)가 회원에게 즉시 환불되고 재고가 복구됩니다.`}
                    confirmLabel="취소·환불 실행"
                    errorTitle="환불 처리 실패"
                    successMessage="주문이 취소되고 포인트가 전액 환불되었습니다."
                  >
                    <input type="hidden" name="restoreStock" value="true" />
                    <button
                      type="submit"
                      className={adminButtonClass({ variant: "danger", size: "md" })}
                    >
                      취소·전액환불
                    </button>
                  </AdminActionForm>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-panel bg-base-1 atlas-border">
            <AdminEmptyState title="해당 조건의 주문이 없습니다." />
          </div>
        )}
      </div>
    </div>
  );
}
