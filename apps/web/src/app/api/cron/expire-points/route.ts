import { NextResponse, type NextRequest } from "next/server";
import { and, eq, getDb, gt, lte, notifications, pointLedgers, pointWallets, sql } from "@repo/db";
import { getServerEnv } from "@/00_lib/env";
import { ensureWalletLocked } from "@/04_services/shared/pointLedgerService";

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
  let expiredRowsCount = 0;
  let totalExpiredPoints = 0;

  // 1. 만료 대상이 존재하는 회원 ID만 선조회 (사용자별 독립 TX + 전역 잠금 순서 준수)
  const candidateUsers = await db
    .selectDistinct({ userId: pointLedgers.userId })
    .from(pointLedgers)
    .where(and(gt(pointLedgers.remainingAmount, 0), lte(pointLedgers.expiresAt, now)));

  for (const { userId } of candidateUsers) {
    await db.transaction(async (tx) => {
      // 전역 잠금 순서 1: point_wallets(FOR UPDATE) 먼저 잠금 (결제 트랜잭션과 데드락 원천 차단)
      const wallet = await ensureWalletLocked(tx, userId);

      // 전역 잠금 순서 2: 잠금 획득 후 만료 로트를 id ASC FOR UPDATE로 재조회 (동시 소비 후 이중 차감 차단)
      const lockedLots = await tx.execute<{ id: string; remaining_amount: string }>(
        sql`SELECT id, remaining_amount
            FROM point_ledgers
            WHERE user_id = ${userId}
              AND remaining_amount > 0
              AND expires_at <= ${now}
            ORDER BY id ASC
            FOR UPDATE`,
      );

      let runningBalance = wallet.balance;

      for (const row of lockedLots.rows) {
        const lotId = Number(row.id);
        const liveRemaining = Number(row.remaining_amount ?? 0);
        if (liveRemaining <= 0) continue;

        // 멱등키 중복 소멸 방어
        const dup = await tx
          .select({ id: pointLedgers.id })
          .from(pointLedgers)
          .where(eq(pointLedgers.idempotencyKey, `expire:${lotId}`))
          .limit(1);
        if (dup[0]) continue;

        const expireAmt = Math.min(liveRemaining, runningBalance);

        await tx
          .update(pointLedgers)
          .set({ remainingAmount: 0 })
          .where(eq(pointLedgers.id, lotId));

        if (expireAmt <= 0) continue;

        runningBalance = Math.max(0, runningBalance - expireAmt);

        await tx.insert(pointLedgers).values({
          userId,
          delta: -expireAmt,
          balanceAfter: runningBalance,
          reason: "EXPIRE",
          idempotencyKey: `expire:${lotId}`,
          refType: "point_ledger",
          refId: lotId,
          memo: "유효기간 만료 자동 소멸",
        });

        await tx.insert(notifications).values({
          userId,
          kind: "POINT_EXPIRE_SOON",
          title: `${expireAmt.toLocaleString("ko-KR")}P가 유효기간 만료로 소멸되었습니다`,
          body: "포인트 지갑에서 상세 원장을 확인할 수 있습니다.",
          deepLink: "/app/wallet",
        });

        expiredRowsCount += 1;
        totalExpiredPoints += expireAmt;
      }

      if (runningBalance !== wallet.balance) {
        await tx
          .update(pointWallets)
          .set({ balance: runningBalance })
          .where(eq(pointWallets.id, wallet.id));
      }
    });
  }

  return NextResponse.json({
    ok: true,
    data: { expiredRowsCount, totalExpiredPoints, executedAt: now.toISOString() },
  });
}
