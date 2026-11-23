import "server-only";
import {
  and,
  courseUnlocks,
  dogs,
  enrollments,
  eq,
  inArray,
  orderItems,
  products,
  productVariants,
  sql,
  userTickets,
  type WaggleDb,
} from "@repo/db";

type DbOrTx = WaggleDb | Parameters<Parameters<WaggleDb["transaction"]>[0]>[0];

export const RECHARGE_INSTANT_CANCEL_MS = 7 * 24 * 60 * 60 * 1000;
export const ORDER_RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type RechargeRefundActionMode =
  | "INSTANT_CANCEL"
  | "REQUEST_REFUND"
  | "REQUESTED"
  | "IAP_STORE"
  | "FULLY_USED"
  | "DONE";

export interface RechargeRefundMeta {
  usedPoints: number;
  remainingPoints: number;
  isUnused: boolean;
  within7Days: boolean;
  refundablePoints: number;
  refundableCash: number;
  actionMode: RechargeRefundActionMode;
}

/**
 * 충전 결제 건의 미사용/부분사용 여부 및 GM-103 환불 가능 금액 단일 계산기
 */
export function computeRechargeRefundMeta(input: {
  status: string;
  channel: "WEB_PG" | "IOS_IAP" | "ANDROID_IAP";
  pointAmount: number;
  paidAmount: number;
  paidAt: Date | null;
  remainingAmount: number;
  walletBalance?: number;
}): RechargeRefundMeta {
  const remainingPoints = Math.max(0, Math.min(input.pointAmount, input.remainingAmount));
  const usedPoints = Math.max(0, input.pointAmount - remainingPoints);
  const isUnused = input.pointAmount > 0 && remainingPoints === input.pointAmount;
  const within7Days = Boolean(
    input.paidAt && Date.now() - input.paidAt.getTime() <= RECHARGE_INSTANT_CANCEL_MS,
  );
  const cappedRemaining =
    input.walletBalance !== undefined
      ? Math.max(0, Math.min(remainingPoints, input.walletBalance))
      : remainingPoints;
  const refundableCash =
    cappedRemaining <= 0 || input.pointAmount <= 0
      ? 0
      : isUnused && cappedRemaining === input.pointAmount
        ? input.paidAmount
        : Math.floor((input.paidAmount * cappedRemaining) / input.pointAmount);

  let actionMode: RechargeRefundActionMode = "DONE";
  if (input.status === "REFUND_REQUESTED") {
    actionMode = "REQUESTED";
  } else if (input.status === "PAID") {
    if (input.channel !== "WEB_PG") {
      actionMode = "IAP_STORE";
    } else if (cappedRemaining <= 0) {
      actionMode = "FULLY_USED";
    } else if (isUnused && within7Days) {
      actionMode = "INSTANT_CANCEL";
    } else {
      actionMode = "REQUEST_REFUND";
    }
  }

  return {
    usedPoints,
    remainingPoints,
    isUnused,
    within7Days,
    refundablePoints: cappedRemaining,
    refundableCash,
    actionMode,
  };
}

/**
 * 주문 취소·환불 시 order_items 기준 상품/옵션 재고 원복 (+ 디지털 잠금해제 회수)
 */
export async function restoreOrderStockTx(
  tx: DbOrTx,
  orderId: number,
  actorId: number,
): Promise<void> {
  const items = await tx
    .select({
      productId: orderItems.productId,
      variantId: orderItems.variantId,
      quantity: orderItems.quantity,
      productTypeSnap: orderItems.productTypeSnap,
    })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), eq(orderItems.isDeleted, false)));

  for (const item of items) {
    if (item.variantId) {
      await tx
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} + ${item.quantity}` })
        .where(eq(productVariants.id, item.variantId));
    } else {
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} + ${item.quantity}` })
        .where(eq(products.id, item.productId));
    }
  }

  // 주문으로 발급된 디지털 티켓은 REVOKED(취소완료 도장) 상태로 회수
  const now = new Date();
  await tx
    .update(userTickets)
    .set({ status: "REVOKED", updatedBy: actorId })
    .where(and(eq(userTickets.orderId, orderId), eq(userTickets.isDeleted, false)));

  // 프리미엄 코스 잠금해제가 연결된 주문이었다면 잠금해제 및 내 교육(enrollments)도 함께 소프트 회수
  const revokedUnlocks = await tx
    .update(courseUnlocks)
    .set({ isDeleted: true, deletedAt: now, deletedBy: actorId })
    .where(and(eq(courseUnlocks.orderId, orderId), eq(courseUnlocks.isDeleted, false)))
    .returning({ userId: courseUnlocks.userId, courseId: courseUnlocks.courseId });

  if (revokedUnlocks.length > 0) {
    const userIds = Array.from(new Set(revokedUnlocks.map((u) => u.userId)));
    const courseIds = Array.from(new Set(revokedUnlocks.map((u) => u.courseId)));
    const userDogs = await tx
      .select({ id: dogs.id })
      .from(dogs)
      .where(and(inArray(dogs.userId, userIds), eq(dogs.isDeleted, false)));
    if (userDogs.length > 0) {
      await tx
        .update(enrollments)
        .set({ isDeleted: true, deletedAt: now, deletedBy: actorId })
        .where(
          and(
            inArray(enrollments.dogId, userDogs.map((d) => d.id)),
            inArray(enrollments.courseId, courseIds),
            eq(enrollments.isDeleted, false),
          ),
        );
    }
  }
}
