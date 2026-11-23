import { NextResponse, type NextRequest } from "next/server";
import { and, eq, getDb, lte, notifications, orders, shipments } from "@repo/db";
import { getServerEnv } from "@/00_lib/env";
import { ORDER_RETURN_WINDOW_MS } from "@/04_services/shared/commerceRefundService";

function isAuthorizedCron(request: NextRequest): boolean {
  const env = getServerEnv();
  const authHeader = request.headers.get("authorization");
  const secretHeader = request.headers.get("x-cron-secret");
  return authHeader === `Bearer ${env.CRON_SECRET}` || secretHeader === env.CRON_SECRET;
}

/**
 * 배송 완료(DELIVERED) 후 7일 경과 실물 주문 자동 구매 확정(CONFIRMED) 크론 배치
 * - 반품 신청이 접수되지 않은 DELIVERED 주문만 안전하게 CONFIRMED로 전환
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();
  const cutoff = new Date(now.getTime() - ORDER_RETURN_WINDOW_MS);

  const candidates = await db
    .select({
      orderId: orders.id,
      orderNo: orders.orderNo,
      userId: orders.userId,
    })
    .from(orders)
    .innerJoin(shipments, and(eq(shipments.orderId, orders.id), eq(shipments.isDeleted, false)))
    .where(
      and(
        eq(orders.status, "DELIVERED"),
        eq(orders.isDeleted, false),
        lte(shipments.deliveredAt, cutoff),
      ),
    );

  let confirmedCount = 0;

  for (const row of candidates) {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(orders)
        .set({
          status: "CONFIRMED",
          confirmedAt: now,
        })
        .where(and(eq(orders.id, row.orderId), eq(orders.status, "DELIVERED")))
        .returning({ id: orders.id });

      if (!updated) return;

      confirmedCount += 1;
      await tx.insert(notifications).values({
        userId: row.userId,
        kind: "ORDER_UPDATE",
        title: `구매가 자동 확정되었어요 (${row.orderNo})`,
        body: "상품 후기를 작성하고 포인트를 적립해 보세요.",
        deepLink: "/app/shop/orders",
      });
    });
  }

  return NextResponse.json({
    ok: true,
    data: { confirmedCount, executedAt: now.toISOString() },
  });
}
