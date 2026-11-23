import { NextResponse, type NextRequest } from "next/server";
import { and, eq, getDb, inArray, inquiries, lte, notifications, userTickets } from "@repo/db";
import { getServerEnv } from "@/00_lib/env";
import { earnPointsTx, ensureWalletLocked } from "@/04_services/shared/pointLedgerService";

function isAuthorizedCron(request: NextRequest): boolean {
  const env = getServerEnv();
  const authHeader = request.headers.get("authorization");
  const secretHeader = request.headers.get("x-cron-secret");
  return authHeader === `Bearer ${env.CRON_SECRET}` || secretHeader === env.CRON_SECRET;
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();
  let refundedCount = 0;

  const overdue = await db
    .select({ id: inquiries.id, userId: inquiries.userId, paidPoints: inquiries.paidPoints })
    .from(inquiries)
    .where(
      and(
        inArray(inquiries.status, ["PENDING", "ASSIGNED"]),
        lte(inquiries.slaDueAt, now),
        eq(inquiries.isDeleted, false),
      ),
    );

  for (const item of overdue) {
    const applied = await db.transaction(async (tx) => {
      // 전역 잠금 순서 1: point_wallets 먼저 잠금
      await ensureWalletLocked(tx, item.userId);

      // 조건부 원자 선점 (사용자 취소와 동시 경합 시 1건만 성공)
      const [claimed] = await tx
        .update(inquiries)
        .set({ status: "EXPIRED", refundedAt: now })
        .where(
          and(
            eq(inquiries.id, item.id),
            inArray(inquiries.status, ["PENDING", "ASSIGNED"]),
            eq(inquiries.isDeleted, false),
          ),
        )
        .returning({ id: inquiries.id, paidPoints: inquiries.paidPoints });

      if (!claimed) return false;

      if (claimed.paidPoints > 0) {
        // 사용자 취소와 동일한 단일 멱등키(inquiry-refund:{id})로 이중 환불 원천 차단
        await earnPointsTx(tx, {
          userId: item.userId,
          amount: claimed.paidPoints,
          reason: "REFUND",
          idempotencyKey: `inquiry-refund:${claimed.id}`,
          refType: "inquiry",
          refId: claimed.id,
          memo: `Q&A #${claimed.id} 48시간 SLA 초과 자동 환불`,
          actorId: null,
        });

        await tx.insert(notifications).values({
          userId: item.userId,
          kind: "INQUIRY_REFUNDED",
          title: "영상 Q&A 48시간 초과 자동 환불",
          body: `${claimed.paidPoints.toLocaleString("ko-KR")}P가 포인트 지갑으로 전액 환불되었습니다.`,
          deepLink: `/app/inquiry/${claimed.id}`,
        });
      } else {
        await tx
          .update(userTickets)
          .set({
            status: "AVAILABLE",
            usedAt: null,
            usedRefId: null,
            usedDogId: null,
          })
          .where(
            and(
              eq(userTickets.userId, item.userId),
              eq(userTickets.ticketType, "INQUIRY_TICKET"),
              eq(userTickets.usedRefId, claimed.id),
              eq(userTickets.status, "USED"),
              eq(userTickets.isDeleted, false),
            ),
          );

        await tx.insert(notifications).values({
          userId: item.userId,
          kind: "INQUIRY_REFUNDED",
          title: "영상 Q&A 48시간 초과 문의권 복구",
          body: "사용하신 1:1 영상 Q&A 문의권 1장이 내 티켓함으로 자동 복구되었습니다.",
          deepLink: "/app/my/tickets",
        });
      }

      return true;
    });

    if (applied) refundedCount += 1;
  }

  return NextResponse.json({
    ok: true,
    data: { refundedCount, executedAt: now.toISOString() },
  });
}
