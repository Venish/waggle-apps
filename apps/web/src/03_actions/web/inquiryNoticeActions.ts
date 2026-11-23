"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  and,
  dogs,
  eq,
  getDb,
  inArray,
  inquiries,
  notifications,
  sql,
  userTickets,
} from "@repo/db";
import { fail, ok, type ActionResult } from "@repo/types";
import { getCurrentUserSession } from "@/00_lib/session";
import {
  earnPointsTx,
  ensureWalletLocked,
  spendPointsFifoTx,
} from "@/04_services/shared/pointLedgerService";
import { getPolicyNumber } from "@/04_services/shared/policyService";

const createInquirySchema = z.object({
  dogId: z.coerce.number().int().positive(),
  question: z.string().min(10, "질문 내용을 10자 이상 작성해 주세요.").max(2000),
  videoUrl: z.string().max(500).optional(),
  ticketId: z.coerce.number().int().positive().optional(),
  idempotencyKey: z.string().trim().min(8).max(100).optional(),
  expectedWalletBalance: z.coerce.number().int().min(0).optional(),
});

export async function createInquiryAction(
  input: z.infer<typeof createInquirySchema>,
): Promise<ActionResult<{ inquiryId: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = createInquirySchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "질문 내용을 확인해 주세요.");
  }

  const price = await getPolicyNumber("inquiry.price");
  const slaHours = await getPolicyNumber("inquiry.sla_hours");
  const db = getDb();

  const [dog] = await db
    .select({ id: dogs.id })
    .from(dogs)
    .where(and(eq(dogs.id, parsed.data.dogId), eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
    .limit(1);
  if (!dog) return fail("FORBIDDEN", "본인 반려견으로만 문의할 수 있습니다.");

  let latestBalance: number | null = null;
  try {
    const inquiryId = await db.transaction(async (tx) => {
      // 전역 잠금 순서 1: point_wallets FOR UPDATE 먼저 잠금
      const wallet = await ensureWalletLocked(tx, session.userId);
      latestBalance = wallet.balance;

      // 멱등키 중복 접수 차단 (연타/네트워크 재시도 시 기존 건 반환)
      if (parsed.data.idempotencyKey) {
        const [dup] = await tx
          .select({ id: inquiries.id })
          .from(inquiries)
          .where(
            and(
              eq(inquiries.idempotencyKey, parsed.data.idempotencyKey),
              eq(inquiries.userId, session.userId),
            ),
          )
          .limit(1);
        if (dup) return dup.id;
      }

      // Stale 탭 차단: 포인트 결제 시에만 화면 로드 시점 잔액과 실제 DB 잔액 대조
      const useTicketId = parsed.data.ticketId;
      if (
        !useTicketId &&
        parsed.data.expectedWalletBalance !== undefined &&
        wallet.balance !== parsed.data.expectedWalletBalance
      ) {
        throw new Error("BALANCE_STALE");
      }

      const now = new Date();
      let consumedTicketId: number | null = null;
      if (useTicketId) {
        const ticketRows = await tx.execute<{
          id: string;
          ticket_type: string;
          status: string;
          expires_at: string | null;
        }>(
          sql`SELECT id, ticket_type, status, expires_at
              FROM user_tickets
              WHERE id = ${useTicketId}
                AND user_id = ${session.userId}
                AND is_deleted = false
              FOR UPDATE`,
        );
        const ticket = ticketRows.rows[0];
        if (!ticket || ticket.ticket_type !== "INQUIRY_TICKET") {
          throw new Error("TICKET_NOT_FOUND");
        }
        if (ticket.status !== "AVAILABLE") {
          throw new Error("TICKET_UNAVAILABLE");
        }
        if (ticket.expires_at && new Date(ticket.expires_at).getTime() <= now.getTime()) {
          await tx
            .update(userTickets)
            .set({ status: "EXPIRED", updatedBy: session.userId })
            .where(eq(userTickets.id, Number(ticket.id)));
          throw new Error("TICKET_EXPIRED");
        }
        consumedTicketId = Number(ticket.id);
      }

      const slaDueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000);
      const [created] = await tx
        .insert(inquiries)
        .values({
          userId: session.userId,
          dogId: dog.id,
          question: parsed.data.question.trim(),
          videoUrl: parsed.data.videoUrl?.trim() || null,
          paidPoints: consumedTicketId ? 0 : price,
          idempotencyKey: parsed.data.idempotencyKey ?? null,
          status: "PENDING",
          slaDueAt,
          createdBy: session.userId,
        })
        .returning();

      if (consumedTicketId) {
        await tx
          .update(userTickets)
          .set({
            status: "USED",
            usedAt: now,
            usedRefId: created!.id,
            usedDogId: dog.id,
            updatedBy: session.userId,
          })
          .where(eq(userTickets.id, consumedTicketId));
      } else {
        await spendPointsFifoTx(tx, {
          userId: session.userId,
          amount: price,
          reason: "SPEND_INQUIRY",
          idempotencyKey: `inquiry:${created!.id}`,
          refType: "inquiry",
          refId: created!.id,
          memo: `훈련사 영상 Q&A #${created!.id} 접수`,
          actorId: session.userId,
        });
      }

      return created!.id;
    });

    revalidatePath("/app/inquiry");
    revalidatePath("/app/wallet");
    revalidatePath("/app/my");
    revalidatePath("/app/my/tickets");
    revalidatePath("/app/shop");
    return ok({ inquiryId });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    if (code === "BALANCE_STALE") {
      return fail(
        "BALANCE_STALE",
        `다른 화면에서 보유 포인트가 변경되었습니다. 최신 잔액(${(latestBalance ?? 0).toLocaleString("ko-KR")}P)을 확인한 뒤 다시 접수해 주세요.`,
        undefined,
        latestBalance !== null ? { latestBalance } : undefined,
      );
    }
    if (code === "TICKET_NOT_FOUND" || code === "TICKET_UNAVAILABLE") {
      return fail("CONFLICT", "선택한 문의권을 사용할 수 없습니다. 새로고침 후 다시 확인해 주세요.");
    }
    if (code === "TICKET_EXPIRED") {
      return fail("CONFLICT", "유효기간이 만료된 문의권입니다.");
    }
    if (code === "INSUFFICIENT_POINTS") {
      return fail(
        "INSUFFICIENT_POINTS",
        `포인트가 부족합니다. (필요 포인트: ${price.toLocaleString("ko-KR")}P)`,
      );
    }
    return fail("INTERNAL_ERROR", "문의 접수 중 오류가 발생했습니다.");
  }
}

export async function cancelInquiryAction(
  inquiryId: number,
): Promise<ActionResult<{ refundedPoints: number; restoredTicket?: boolean }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const db = getDb();
  try {
    const result = await db.transaction(async (tx) => {
      // 전역 잠금 순서 1: point_wallets 먼저 잠금
      await ensureWalletLocked(tx, session.userId);

      // 조건부 원자 선점 (48h SLA 크론 및 2탭 동시 취소와 경합 시 1건만 성공)
      const [claimed] = await tx
        .update(inquiries)
        .set({ status: "CANCELLED", refundedAt: new Date(), updatedBy: session.userId })
        .where(
          and(
            eq(inquiries.id, inquiryId),
            eq(inquiries.userId, session.userId),
            inArray(inquiries.status, ["PENDING", "ASSIGNED"]),
            eq(inquiries.isDeleted, false),
          ),
        )
        .returning({ id: inquiries.id, paidPoints: inquiries.paidPoints });

      if (!claimed) {
        throw new Error("INQUIRY_CANCEL_CONFLICT");
      }

      if (claimed.paidPoints > 0) {
        // SLA 크론과 동일한 단일 멱등키(inquiry-refund:{id}) 사용 → 200% 이중 환불 원천 차단
        await earnPointsTx(tx, {
          userId: session.userId,
          amount: claimed.paidPoints,
          reason: "REFUND",
          idempotencyKey: `inquiry-refund:${claimed.id}`,
          refType: "inquiry",
          refId: claimed.id,
          memo: `Q&A #${claimed.id} 취소 환불`,
          actorId: session.userId,
        });
        return { refundedPoints: claimed.paidPoints, restoredTicket: false };
      }

      // 문의권으로 접수된 건은 티켓 1장 AVAILABLE로 원복
      const restored = await tx
        .update(userTickets)
        .set({
          status: "AVAILABLE",
          usedAt: null,
          usedRefId: null,
          usedDogId: null,
          updatedBy: session.userId,
        })
        .where(
          and(
            eq(userTickets.userId, session.userId),
            eq(userTickets.ticketType, "INQUIRY_TICKET"),
            eq(userTickets.usedRefId, claimed.id),
            eq(userTickets.status, "USED"),
            eq(userTickets.isDeleted, false),
          ),
        )
        .returning({ id: userTickets.id });

      return { refundedPoints: 0, restoredTicket: restored.length > 0 };
    });

    revalidatePath("/app/inquiry");
    revalidatePath(`/app/inquiry/${inquiryId}`);
    revalidatePath("/app/wallet");
    revalidatePath("/app/my");
    revalidatePath("/app/my/tickets");
    revalidatePath("/app/shop");
    return ok(result);
  } catch (error) {
    if (error instanceof Error && error.message === "INQUIRY_CANCEL_CONFLICT") {
      return fail("CONFLICT", "이미 답변 완료되었거나 취소·환불된 문의입니다.");
    }
    return fail("INTERNAL_ERROR", "문의 취소 중 오류가 발생했습니다.");
  }
}

export async function markNotificationReadAction(
  notificationId: number,
): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const db = getDb();
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, session.userId)));

  revalidatePath("/app/my/notifications");
  revalidatePath("/app", "layout");
  return ok({ ok: true });
}

export async function deleteNotificationAction(
  notificationId: number,
): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const db = getDb();
  await db
    .delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, session.userId)));

  revalidatePath("/app/my/notifications");
  revalidatePath("/app", "layout");
  return ok({ ok: true });
}
