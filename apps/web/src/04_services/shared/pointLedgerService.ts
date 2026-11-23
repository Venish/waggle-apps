import "server-only";
import {
  and,
  eq,
  getDb,
  gt,
  gte,
  inArray,
  lte,
  pointLedgers,
  pointWallets,
  sql,
  type WaggleDb,
} from "@repo/db";
import { planFifoConsumption } from "@repo/types";
import { getPolicyNumber } from "./policyService";

type DbOrTx = WaggleDb | Parameters<Parameters<WaggleDb["transaction"]>[0]>[0];
type PointReason = typeof pointLedgers.$inferInsert.reason;

export async function ensureWalletLocked(
  tx: DbOrTx,
  userId: number,
): Promise<{ id: number; balance: number }> {
  // 신규 회원 동시 첫 거래 시 UNIQUE 충돌 원천 차단 (부분 유니크 인덱스 기준)
  await tx.execute(
    sql`INSERT INTO point_wallets (user_id, balance, created_by)
        VALUES (${userId}, 0, ${userId})
        ON CONFLICT (user_id) WHERE is_deleted = false DO NOTHING`,
  );
  const existing = await tx.execute<{ id: string; balance: string }>(
    sql`SELECT id, balance FROM point_wallets WHERE user_id = ${userId} AND is_deleted = false FOR UPDATE`,
  );
  return {
    id: Number(existing.rows[0]!.id),
    balance: Number(existing.rows[0]!.balance),
  };
}

export async function earnPointsTx(
  tx: DbOrTx,
  input: {
    userId: number;
    dogId?: number | null;
    amount: number;
    reason: PointReason;
    idempotencyKey?: string;
    refType?: string;
    refId?: number;
    memo?: string;
    actorId?: number | null;
    enforceDailyEducationCap?: boolean;
  },
): Promise<{ applied: boolean; awardedAmount: number; balanceAfter: number }> {
  if (input.amount <= 0) {
    const wallet = await ensureWalletLocked(tx, input.userId);
    return { applied: false, awardedAmount: 0, balanceAfter: wallet.balance };
  }

  // 멱등키 중복 지급 차단
  if (input.idempotencyKey) {
    const dup = await tx
      .select({ id: pointLedgers.id, balanceAfter: pointLedgers.balanceAfter })
      .from(pointLedgers)
      .where(eq(pointLedgers.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (dup[0]) {
      return { applied: false, awardedAmount: 0, balanceAfter: dup[0].balanceAfter };
    }
  }

  const wallet = await ensureWalletLocked(tx, input.userId);
  let finalAmount = input.amount;

  if (input.enforceDailyEducationCap) {
    const cap = await getPolicyNumber("point.daily_earn_cap");
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const earnedTodayRows = await tx
      .select({ total: sql<string>`COALESCE(SUM(${pointLedgers.delta}), 0)` })
      .from(pointLedgers)
      .where(
        and(
          eq(pointLedgers.userId, input.userId),
          gte(pointLedgers.createdAt, startOfDay),
          inArray(pointLedgers.reason, [
            "EARN_EDUCATION_WATCH",
            "EARN_EDUCATION_PRACTICE",
            "EARN_EDUCATION_QUIZ",
          ]),
        ),
      );
    const earnedToday = Number(earnedTodayRows[0]?.total ?? 0);
    const remainingCap = Math.max(0, cap - earnedToday);
    finalAmount = Math.min(finalAmount, remainingCap);
    if (finalAmount <= 0) {
      return { applied: false, awardedAmount: 0, balanceAfter: wallet.balance };
    }
  }

  const expireDays = await getPolicyNumber("point.expire_days");
  const expiresAt = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000);
  const balanceAfter = wallet.balance + finalAmount;

  await tx.insert(pointLedgers).values({
    userId: input.userId,
    dogId: input.dogId ?? null,
    delta: finalAmount,
    balanceAfter,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey ?? null,
    refType: input.refType ?? null,
    refId: input.refId ?? null,
    memo: input.memo ?? null,
    expiresAt,
    remainingAmount: finalAmount,
    createdBy: input.actorId ?? input.userId,
  });

  await tx
    .update(pointWallets)
    .set({ balance: balanceAfter, updatedBy: input.actorId ?? input.userId })
    .where(eq(pointWallets.id, wallet.id));

  return { applied: true, awardedAmount: finalAmount, balanceAfter };
}

export async function spendPointsFifoTx(
  tx: DbOrTx,
  input: {
    userId: number;
    amount: number;
    reason: PointReason;
    idempotencyKey?: string;
    refType?: string;
    refId?: number;
    memo?: string;
    actorId?: number | null;
  },
): Promise<{ balanceAfter: number }> {
  if (input.amount <= 0) {
    throw new Error("차감 포인트는 0보다 커야 합니다.");
  }

  const wallet = await ensureWalletLocked(tx, input.userId);

  // 멱등키 중복 차감 선조회 차단
  if (input.idempotencyKey) {
    const dup = await tx
      .select({ id: pointLedgers.id, balanceAfter: pointLedgers.balanceAfter })
      .from(pointLedgers)
      .where(eq(pointLedgers.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (dup[0]) {
      return { balanceAfter: dup[0].balanceAfter };
    }
  }

  if (wallet.balance < input.amount) {
    throw new Error("INSUFFICIENT_POINTS");
  }

  // FIFO 선입선출 적립 원장 소진 (미만료 로트만 id ASC FOR UPDATE 잠금)
  const earnRows = await tx.execute<{
    id: string;
    remaining_amount: string;
    expires_at: string | Date | null;
  }>(
    sql`SELECT id, remaining_amount, expires_at
        FROM point_ledgers
        WHERE user_id = ${input.userId}
          AND remaining_amount > 0
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY id ASC
        FOR UPDATE`,
  );

  const plan = planFifoConsumption(
    earnRows.rows.map((r) => ({
      id: Number(r.id),
      remainingAmount: Number(r.remaining_amount ?? 0),
      expiresAt: r.expires_at ? new Date(r.expires_at) : null,
    })),
    input.amount,
  );

  if (plan.shortfall > 0) {
    // 지갑 잔액은 있으나 모두 만료 도래 로트인 경우에도 안전하게 부족 처리
    throw new Error("INSUFFICIENT_POINTS");
  }

  for (const c of plan.consumptions) {
    await tx
      .update(pointLedgers)
      .set({ remainingAmount: sql`${pointLedgers.remainingAmount} - ${c.consume}` })
      .where(eq(pointLedgers.id, c.id));
  }

  const balanceAfter = wallet.balance - input.amount;
  if (balanceAfter < 0) {
    throw new Error("INSUFFICIENT_POINTS");
  }

  await tx.insert(pointLedgers).values({
    userId: input.userId,
    delta: -input.amount,
    balanceAfter,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey ?? null,
    refType: input.refType ?? null,
    refId: input.refId ?? null,
    memo: input.memo ?? null,
    createdBy: input.actorId ?? input.userId,
  });

  await tx
    .update(pointWallets)
    .set({ balance: balanceAfter, updatedBy: input.actorId ?? input.userId })
    .where(eq(pointWallets.id, wallet.id));

  return { balanceAfter };
}

/**
 * 충전 결제 취소·환불 전용 원장 회수 (단일 TX)
 * - 잠금 순서 고정: point_wallets(FOR UPDATE) → 원본 EARN_RECHARGE 원장 검증 → remainingAmount 차감 + RECHARGE_REFUND 음수 원장 기록
 */
export async function revokeRechargeLedgerTx(
  tx: DbOrTx,
  input: {
    userId: number;
    rechargeId: number;
    amount: number;
    idempotencyKey: string;
    memo: string;
    actorId: number;
  },
): Promise<{ applied: boolean; revokedAmount: number; balanceAfter: number }> {
  const wallet = await ensureWalletLocked(tx, input.userId);

  // 멱등키 중복 회수 차단
  const dup = await tx
    .select({ id: pointLedgers.id, balanceAfter: pointLedgers.balanceAfter })
    .from(pointLedgers)
    .where(eq(pointLedgers.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (dup[0]) {
    return { applied: false, revokedAmount: 0, balanceAfter: dup[0].balanceAfter };
  }

  const originRows = await tx.execute<{ id: string; remaining_amount: string }>(
    sql`SELECT id, remaining_amount
        FROM point_ledgers
        WHERE user_id = ${input.userId}
          AND reason = 'EARN_RECHARGE'
          AND ref_type = 'recharge'
          AND ref_id = ${input.rechargeId}
        ORDER BY id ASC
        LIMIT 1
        FOR UPDATE`,
  );
  const originLedger = originRows.rows[0]
    ? {
        id: Number(originRows.rows[0].id),
        remainingAmount: Number(originRows.rows[0].remaining_amount ?? 0),
      }
    : null;

  const remaining = originLedger?.remainingAmount ?? 0;
  if (!originLedger || input.amount <= 0 || remaining < input.amount) {
    throw new Error("RECHARGE_NOT_REFUNDABLE");
  }
  if (wallet.balance < input.amount) {
    throw new Error("INSUFFICIENT_POINTS");
  }

  const balanceAfter = wallet.balance - input.amount;

  // 환불된 충전 원장의 잔여량 차감 (중복 환불·소멸 방지)
  await tx
    .update(pointLedgers)
    .set({ remainingAmount: remaining - input.amount })
    .where(eq(pointLedgers.id, originLedger.id));

  await tx.insert(pointLedgers).values({
    userId: input.userId,
    delta: -input.amount,
    balanceAfter,
    reason: "RECHARGE_REFUND",
    idempotencyKey: input.idempotencyKey,
    refType: "recharge",
    refId: input.rechargeId,
    memo: input.memo,
    createdBy: input.actorId,
  });

  await tx
    .update(pointWallets)
    .set({ balance: balanceAfter, updatedBy: input.actorId })
    .where(eq(pointWallets.id, wallet.id));

  return { applied: true, revokedAmount: input.amount, balanceAfter };
}

export async function getWalletSummary(userId: number) {
  const db = getDb();
  const [wallet] = await db
    .select()
    .from(pointWallets)
    .where(and(eq(pointWallets.userId, userId), eq(pointWallets.isDeleted, false)))
    .limit(1);

  const soonDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [expiring] = await db
    .select({ total: sql<string>`COALESCE(SUM(${pointLedgers.remainingAmount}), 0)` })
    .from(pointLedgers)
    .where(
      and(
        eq(pointLedgers.userId, userId),
        gt(pointLedgers.remainingAmount, 0),
        lte(pointLedgers.expiresAt, soonDate),
      ),
    );

  return {
    balance: wallet?.balance ?? 0,
    expiringIn30Days: Number(expiring?.total ?? 0),
  };
}
