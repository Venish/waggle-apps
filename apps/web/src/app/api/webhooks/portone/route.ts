import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  and,
  eq,
  getDb,
  notifications,
  paymentEventLogs,
  pointRecharges,
  sql,
} from "@repo/db";
import { sendPushAdapter, verifyPortoneWebhookSignature } from "@/00_lib/adapters";
import { earnPointsTx, ensureWalletLocked } from "@/04_services/shared/pointLedgerService";

const webhookSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().default("Transaction.Paid"),
  paymentId: z.string().min(1),
  rechargeId: z.coerce.number().int().positive(),
  paidAmount: z.coerce.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-portone-signature");

  if (!verifyPortoneWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { eventId, eventType, paymentId, rechargeId, paidAmount } = parsed.data;
  const db = getDb();

  try {
    const result = await db.transaction(async (tx) => {
      // 1. 멱등키 중복 수신 검사
      const dup = await tx
        .select({ id: paymentEventLogs.id })
        .from(paymentEventLogs)
        .where(
          and(eq(paymentEventLogs.provider, "portone"), eq(paymentEventLogs.eventId, eventId)),
        )
        .limit(1);

      if (dup[0]) {
        return { duplicate: true as const, userId: 0, pointAmount: 0 };
      }

      // 2. 전역 잠금 순서 준수: 소유 userId 선조회 → point_wallets FOR UPDATE → point_recharges FOR UPDATE
      const [ownerRow] = await tx
        .select({ userId: pointRecharges.userId })
        .from(pointRecharges)
        .where(and(eq(pointRecharges.id, rechargeId), eq(pointRecharges.isDeleted, false)))
        .limit(1);
      if (!ownerRow) {
        throw new Error("RECHARGE_NOT_FOUND");
      }

      await ensureWalletLocked(tx, ownerRow.userId);

      const rechargeRows = await tx.execute<{
        id: string;
        user_id: string;
        paid_amount: string;
        point_amount: string;
        package_code: string | null;
        status: string;
      }>(
        sql`SELECT id, user_id, paid_amount, point_amount, package_code, status
            FROM point_recharges
            WHERE id = ${rechargeId} AND is_deleted = false
            FOR UPDATE`,
      );
      const rawRecharge = rechargeRows.rows[0];
      if (!rawRecharge) {
        throw new Error("RECHARGE_NOT_FOUND");
      }
      const recharge = {
        id: Number(rawRecharge.id),
        userId: Number(rawRecharge.user_id),
        paidAmount: Number(rawRecharge.paid_amount),
        pointAmount: Number(rawRecharge.point_amount),
        packageCode: rawRecharge.package_code,
        status: rawRecharge.status,
      };
      if (recharge.paidAmount !== paidAmount) {
        throw new Error("AMOUNT_MISMATCH");
      }

      await tx.insert(paymentEventLogs).values({
        provider: "portone",
        eventId,
        rechargeId: recharge.id,
        eventType,
        payload: parsed.data,
      });

      if (recharge.status === "PAID" || recharge.status === "REFUNDED") {
        return { duplicate: true as const, userId: recharge.userId, pointAmount: recharge.pointAmount };
      }

      await tx
        .update(pointRecharges)
        .set({
          status: "PAID",
          paymentId,
          paidAt: new Date(),
          updatedBy: recharge.userId,
        })
        .where(eq(pointRecharges.id, recharge.id));

      await earnPointsTx(tx, {
        userId: recharge.userId,
        amount: recharge.pointAmount,
        reason: "EARN_RECHARGE",
        idempotencyKey: `recharge:${recharge.id}`,
        refType: "recharge",
        refId: recharge.id,
        memo: `포인트 충전 (${recharge.packageCode ?? "WEB_PG"})`,
        actorId: recharge.userId,
      });

      await tx.insert(notifications).values({
        userId: recharge.userId,
        kind: "POINT_EARNED",
        title: `${recharge.pointAmount.toLocaleString("ko-KR")}P 충전 완료`,
        body: "포인트 지갑에서 충전 내역을 확인해 보세요.",
        deepLink: "/app/wallet",
      });

      return { duplicate: false as const, userId: recharge.userId, pointAmount: recharge.pointAmount };
    });

    if (!result.duplicate) {
      after(async () => {
        await sendPushAdapter({
          userId: result.userId,
          title: "포인트 충전 완료",
          body: `${result.pointAmount.toLocaleString("ko-KR")}P가 적립되었습니다.`,
          deepLink: "/app/wallet",
        });
      });
    }

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    const status = message === "AMOUNT_MISMATCH" ? 409 : message === "RECHARGE_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
