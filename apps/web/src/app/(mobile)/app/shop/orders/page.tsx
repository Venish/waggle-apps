import { and, desc, eq, getDb, inArray, orderItems, orders, productReviews, shipments, userTickets } from "@repo/db";
import { Package } from "lucide-react";
import { formatDateDot } from "@/00_lib/formatDate";
import { requireUserSession } from "@/00_lib/session";
import { ORDER_RETURN_WINDOW_MS } from "@/04_services/shared/commerceRefundService";
import { getShopReviewPolicy } from "@/04_services/shared/policyService";
import { getPrimaryProductImagesMap } from "@/04_services/shared/shopReviewService";
import type { OrderReviewItemMeta } from "@/components/web/OrderCardActionsClient";
import {
  ShopOrdersListClient,
  type ShopOrderListItemView,
} from "@/components/web/ShopOrdersListClient";
import { EmptyStateCard, SubPageHeader } from "@/components/web/WebUiKit";

export const dynamic = "force-dynamic";

export default async function ShopOrdersPage() {
  const session = await requireUserSession();
  const db = getDb();

  const [myOrders, reviewPolicy] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(and(eq(orders.userId, session.userId), eq(orders.isDeleted, false)))
      .orderBy(desc(orders.id))
      .limit(30),
    getShopReviewPolicy(),
  ]);

  const orderIds = myOrders.map((o) => o.id);
  const [allItems, allShipments, myReviews, orderTicketRows] =
    orderIds.length > 0
      ? await Promise.all([
          db
            .select()
            .from(orderItems)
            .where(and(inArray(orderItems.orderId, orderIds), eq(orderItems.isDeleted, false))),
          db
            .select()
            .from(shipments)
            .where(and(inArray(shipments.orderId, orderIds), eq(shipments.isDeleted, false))),
          db
            .select({
              id: productReviews.id,
              orderItemId: productReviews.orderItemId,
              rating: productReviews.rating,
              content: productReviews.content,
              imageUrls: productReviews.imageUrls,
            })
            .from(productReviews)
            .where(
              and(
                inArray(productReviews.orderId, orderIds),
                eq(productReviews.userId, session.userId),
                eq(productReviews.isDeleted, false),
              ),
            ),
          db
            .select({ orderId: userTickets.orderId, status: userTickets.status })
            .from(userTickets)
            .where(
              and(
                inArray(userTickets.orderId, orderIds),
                eq(userTickets.userId, session.userId),
                eq(userTickets.isDeleted, false),
              ),
            ),
        ])
      : [[], [], [], []];

  const reviewByItemId = new Map(myReviews.map((r) => [r.orderItemId, r]));
  const imageMap = await getPrimaryProductImagesMap(
    Array.from(new Set(allItems.map((i) => i.productId))),
  );
  const now = Date.now();

  const orderViews: ShopOrderListItemView[] = myOrders.map((ord) => {
    const items = allItems.filter((i) => i.orderId === ord.id);
    const ship = allShipments.find((s) => s.orderId === ord.id);
    const hasShipment = Boolean(ship);
    const deliveredAtMs = (ship?.deliveredAt ?? ord.updatedAt).getTime();
    const canReturn =
      ord.status === "DELIVERED" &&
      hasShipment &&
      now - deliveredAtMs <= ORDER_RETURN_WINDOW_MS;

    const physicalReviewItems: OrderReviewItemMeta[] = items
      .filter((it) => it.productTypeSnap === "PHYSICAL")
      .map((it) => {
        const rev = reviewByItemId.get(it.id);
        return {
          orderItemId: it.id,
          productId: it.productId,
          nameSnap: it.nameSnap,
          existingReview: rev
            ? {
                id: rev.id,
                rating: rev.rating,
                content: rev.content,
                imageUrls: rev.imageUrls ?? [],
              }
            : null,
        };
      });

    const linkedTickets = orderTicketRows.filter((t) => t.orderId === ord.id);
    const canCancelDigital =
      ord.status === "DELIVERED" &&
      !hasShipment &&
      items.length > 0 &&
      items.every((it) => it.productTypeSnap !== "PHYSICAL") &&
      linkedTickets.length > 0 &&
      linkedTickets.every((t) => t.status === "AVAILABLE");

    return {
      id: ord.id,
      orderNo: ord.orderNo,
      createdAtText: formatDateDot(ord.createdAt),
      status: ord.status,
      paidPoints: ord.paidPoints,
      addressSnapshot: ord.addressSnapshot,
      cancelReason: ord.cancelReason,
      adminRejectReason: ord.adminRejectReason,
      hasShipment,
      canReturn,
      canCancelDigital,
      shipment: ship
        ? {
            courier: ship.courier,
            trackingNo: ship.trackingNo,
            status: ship.status,
          }
        : null,
      items: items.map((it) => ({
        id: it.id,
        productId: it.productId,
        nameSnap: it.nameSnap,
        quantity: it.quantity,
        thumb: imageMap.get(it.productId) ?? null,
      })),
      physicalReviewItems,
    };
  });

  return (
    <div className="flex flex-1 flex-col space-y-4">
      <SubPageHeader title="주문 · 배송 조회" backHref="/app/shop" />

      {orderViews.length === 0 ? (
        <EmptyStateCard
          icon={<Package className="size-5.5" strokeWidth={1.7} />}
          title="주문 내역이 없습니다"
          description="포인트샵에서 첫 상품을 구매해 보세요."
          ctaLabel="포인트샵 가기"
          ctaHref="/app/shop"
        />
      ) : (
        <ShopOrdersListClient orders={orderViews} reviewPolicy={reviewPolicy} />
      )}
    </div>
  );
}
