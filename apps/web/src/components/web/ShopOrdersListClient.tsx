"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, MapPin, Package, Truck } from "lucide-react";
import type { OrderAddressSnapshot } from "@repo/db";
import { WaggleMark } from "@repo/ui";
import type { ShopReviewPolicy } from "@/04_services/shared/policyService";
import {
  OrderCardActionsClient,
  type OrderReviewItemMeta,
} from "@/components/web/OrderCardActionsClient";
import { EmptyStateCard } from "@/components/web/WebUiKit";
import { AppBadge, AppChip, AppLink, type AppBadgeTone } from "@/components/web/ui";

export interface ShopOrderListItemView {
  id: number;
  orderNo: string;
  createdAtText: string;
  status: string;
  paidPoints: number;
  addressSnapshot: OrderAddressSnapshot;
  cancelReason: string | null;
  adminRejectReason: string | null;
  hasShipment: boolean;
  canReturn: boolean;
  canCancelDigital?: boolean;
  shipment: {
    courier: string | null;
    trackingNo: string | null;
    status: string;
  } | null;
  items: Array<{
    id: number;
    productId: number;
    nameSnap: string;
    quantity: number;
    thumb: string | null;
  }>;
  physicalReviewItems: OrderReviewItemMeta[];
}

const ORDER_STATUS_META: Record<string, { label: string; tone: AppBadgeTone }> = {
  PENDING: { label: "결제 대기", tone: "neutral" },
  PAID: { label: "결제 완료", tone: "brand" },
  PREPARING: { label: "배송 준비", tone: "ink" },
  SHIPPING: { label: "배송 중", tone: "brand" },
  DELIVERED: { label: "배송 완료", tone: "brand" },
  CONFIRMED: { label: "구매 확정", tone: "ink" },
  CANCEL_REQUESTED: { label: "취소 요청 중", tone: "danger" },
  RETURN_REQUESTED: { label: "반품 요청 중", tone: "danger" },
  CANCELLED: { label: "취소 완료", tone: "neutral" },
  REFUNDED: { label: "환불 완료", tone: "neutral" },
  FAILED: { label: "결제 실패", tone: "danger" },
};

const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  READY: "발송 준비",
  SHIPPING: "배송 중",
  DELIVERED: "배송 완료",
  RETURNED: "반품 회수",
};

type FilterTab = "ALL" | "ACTIVE" | "CLOSED";

function classifyOrder(ord: ShopOrderListItemView) {
  const isCancelledOrRefunded =
    ord.status === "CANCELLED" || ord.status === "REFUNDED" || ord.status === "FAILED";
  const allPhysicalReviewed =
    ord.status === "CONFIRMED" &&
    (ord.physicalReviewItems.length === 0 ||
      ord.physicalReviewItems.every((item) => item.existingReview !== null));
  const isClosed = isCancelledOrRefunded || allPhysicalReviewed;
  return { isClosed, isCancelledOrRefunded, allPhysicalReviewed };
}

export function ShopOrdersListClient({
  orders,
  reviewPolicy,
}: {
  orders: ShopOrderListItemView[];
  reviewPolicy: ShopReviewPolicy;
}) {
  const [filter, setFilter] = useState<FilterTab>("ALL");

  const counts = useMemo(() => {
    let active = 0;
    let closed = 0;
    for (const o of orders) {
      if (classifyOrder(o).isClosed) closed += 1;
      else active += 1;
    }
    return { all: orders.length, active, closed };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (filter === "ALL") return orders;
    return orders.filter((o) => {
      const { isClosed } = classifyOrder(o);
      return filter === "CLOSED" ? isClosed : !isClosed;
    });
  }, [orders, filter]);

  return (
    <div className="flex flex-1 flex-col space-y-4 pb-6">
      {/* 상태 필터 칩 */}
      <div className="flex items-center gap-1.5">
        <AppChip selected={filter === "ALL"} onClick={() => setFilter("ALL")}>
          전체 {counts.all}
        </AppChip>
        <AppChip selected={filter === "ACTIVE"} onClick={() => setFilter("ACTIVE")}>
          진행 중 {counts.active}
        </AppChip>
        <AppChip selected={filter === "CLOSED"} onClick={() => setFilter("CLOSED")}>
          완료 · 취소 {counts.closed}
        </AppChip>
      </div>

      {filteredOrders.length === 0 ? (
        <EmptyStateCard
          mode="section"
          icon={<Package className="size-5.5" strokeWidth={1.7} />}
          title={
            filter === "ACTIVE"
              ? "진행 중인 주문이 없습니다"
              : "완료 · 취소된 주문이 없습니다"
          }
          description="다른 필터를 선택해 전체 주문 내역을 확인해 보세요."
        />
      ) : (
        <ul className="-mx-4 border-t border-ink/[0.08]">
          {filteredOrders.map((ord, idx) => {
            const { isClosed, isCancelledOrRefunded, allPhysicalReviewed } = classifyOrder(ord);
            const baseMeta = ORDER_STATUS_META[ord.status] ?? {
              label: ord.status,
              tone: "neutral" as const,
            };
            const badgeLabel =
              allPhysicalReviewed && ord.physicalReviewItems.length > 0
                ? "구매 확정 · 후기 완료"
                : ord.status === "DELIVERED" && !ord.hasShipment
                  ? "티켓 발급 완료"
                  : baseMeta.label;
            const badgeTone: AppBadgeTone = isClosed ? "neutral" : baseMeta.tone;

            return (
              <li key={ord.id}>
                {idx > 0 && (
                  <div
                    aria-hidden="true"
                    className="h-2.5 border-y border-ink/[0.07] bg-ink/[0.04]"
                  />
                )}
                <div className={isClosed ? "bg-surface-subtle/75 px-4 py-4.5" : "bg-canvas px-4 py-5"}>
                  {/* 1. 상태 · 날짜 최우선 헤더 (주문번호는 서브 메타로 정리) */}
                  <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <AppBadge tone={badgeTone}>{badgeLabel}</AppBadge>
                      <span className="text-xs font-medium tabular-nums text-ink-muted">
                        {ord.createdAtText}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-ink-muted/80">
                      {ord.orderNo}
                    </span>
                  </div>

                  {/* 2. 주문 상품 목록 */}
                  <ul className="mt-3.5 space-y-2.5 text-sm">
                    {ord.items.map((it) => (
                      <li key={it.id} className="flex items-center gap-3">
                        <AppLink
                          href={`/app/shop/products/${it.productId}`}
                          className={`size-12 shrink-0 overflow-hidden rounded-xl bg-surface-subtle ${
                            isCancelledOrRefunded
                              ? "opacity-55 grayscale-[45%]"
                              : isClosed
                                ? "opacity-80"
                                : ""
                          }`}
                        >
                          {it.thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={it.thumb}
                              alt={it.nameSnap}
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center bg-brand">
                              <WaggleMark className="w-[46%] text-on-brand/95" />
                            </div>
                          )}
                        </AppLink>
                        <div className="min-w-0 flex-1">
                          <AppLink
                            href={`/app/shop/products/${it.productId}`}
                            className={`line-clamp-2 text-sm font-semibold leading-snug hover:underline ${
                              isCancelledOrRefunded
                                ? "text-ink-muted"
                                : isClosed
                                  ? "text-ink/85"
                                  : "text-ink"
                            }`}
                          >
                            {it.nameSnap}
                          </AppLink>
                          <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                            수량 {it.quantity}개
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* 3. 결제 포인트 요약 */}
                  <div className="mt-3.5 flex items-center justify-between border-t border-border-subtle/70 pt-3">
                    <span className="text-xs font-medium text-ink-muted">
                      {isCancelledOrRefunded ? "취소 · 환불 포인트" : "결제 포인트"}
                    </span>
                    <span
                      className={
                        isCancelledOrRefunded
                          ? "text-sm font-bold tabular-nums text-ink-muted line-through"
                          : isClosed
                            ? "text-sm font-bold tabular-nums text-ink/80"
                            : "text-base font-extrabold tabular-nums text-ink"
                      }
                    >
                      {ord.paidPoints.toLocaleString("ko-KR")} P
                    </span>
                  </div>

                  {/* 4. 배송지 / 송장 — 진행 중 주문은 상세 표시, 취소·환불은 숨김, 종결 구매확정은 1줄 압축 */}
                  {!isCancelledOrRefunded &&
                    ord.hasShipment &&
                    (isClosed ? (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
                        <CheckCircle2
                          className="size-3.5 shrink-0 text-ink-muted/70"
                          strokeWidth={2}
                        />
                        <span className="truncate">
                          {ord.addressSnapshot.receiver} ·{" "}
                          {ord.shipment?.trackingNo
                            ? `${ord.shipment.courier ?? "택배"} ${ord.shipment.trackingNo}`
                            : ord.addressSnapshot.addr1}
                        </span>
                      </p>
                    ) : (
                      <>
                        <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-ink-muted">
                          <MapPin
                            className="mt-0.5 size-3.5 shrink-0 text-ink-muted"
                            strokeWidth={2}
                          />
                          <span>
                            {ord.addressSnapshot.receiver} · {ord.addressSnapshot.addr1}
                            {ord.addressSnapshot.addr2 ? ` ${ord.addressSnapshot.addr2}` : ""}
                          </span>
                        </p>

                        {ord.shipment?.trackingNo && (
                          <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-surface-subtle px-3 py-2 text-xs tabular-nums text-ink-muted">
                            <Truck className="size-3.5 shrink-0 text-brand" strokeWidth={2} />
                            <span>
                              {ord.shipment.courier ?? "택배"} {ord.shipment.trackingNo} (
                              {SHIPMENT_STATUS_LABEL[ord.shipment.status] ?? ord.shipment.status})
                            </span>
                          </p>
                        )}
                      </>
                    ))}

                  {(ord.status === "CANCEL_REQUESTED" || ord.status === "RETURN_REQUESTED") &&
                    ord.cancelReason && (
                      <p className="mt-2 rounded-xl bg-surface-subtle px-3 py-2 text-xs text-ink-muted">
                        신청 사유: <span className="font-medium text-ink">{ord.cancelReason}</span>
                      </p>
                    )}

                  {ord.adminRejectReason &&
                    ord.status !== "CANCELLED" &&
                    ord.status !== "REFUNDED" && (
                      <p className="mt-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        반려 사유: {ord.adminRejectReason}
                      </p>
                    )}

                  <OrderCardActionsClient
                    orderId={ord.id}
                    orderNo={ord.orderNo}
                    status={ord.status}
                    hasShipment={ord.hasShipment}
                    canReturn={ord.canReturn}
                    canCancelDigital={ord.canCancelDigital}
                    addressSnapshot={ord.addressSnapshot}
                    physicalReviewItems={ord.physicalReviewItems}
                    reviewPolicy={reviewPolicy}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
