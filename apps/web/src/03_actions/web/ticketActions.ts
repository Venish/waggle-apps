"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  and,
  asc,
  courses,
  courseUnlocks,
  desc,
  dogs,
  enrollments,
  eq,
  getDb,
  notifications,
  orderItems,
  orders,
  products,
  sql,
  userTickets,
} from "@repo/db";
import { fail, ok, type ActionResult } from "@repo/types";
import { getCurrentUserSession } from "@/00_lib/session";
import {
  ensureWalletLocked,
  spendPointsFifoTx,
} from "@/04_services/shared/pointLedgerService";

const redeemCourseTicketSchema = z.object({
  ticketId: z.coerce.number().int().positive(),
  dogId: z.coerce.number().int().positive().optional(),
});

/**
 * 보유 중인 프리미엄 코스 티켓(AVAILABLE) 1장 사용
 * - 티켓 상태 USED(멍멍이 발도장) 전환 + course_unlocks 해제 + 선택 반려견 내 교육(enrollments) 자동 담기
 */
export async function redeemCourseTicketAction(
  input: z.infer<typeof redeemCourseTicketSchema>,
): Promise<ActionResult<{ courseId: number; dogId: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = redeemCourseTicketSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "유효하지 않은 티켓 요청입니다.");
  }

  const db = getDb();
  try {
    const result = await db.transaction(async (tx) => {
      const now = new Date();
      const ticketRows = await tx.execute<{
        id: string;
        user_id: string;
        ticket_type: "PREMIUM_UNLOCK" | "INQUIRY_TICKET";
        order_id: string | null;
        course_id: string | null;
        status: "AVAILABLE" | "USED" | "EXPIRED" | "REVOKED";
        expires_at: string | null;
      }>(
        sql`SELECT id, user_id, ticket_type, order_id, course_id, status, expires_at
            FROM user_tickets
            WHERE id = ${parsed.data.ticketId}
              AND user_id = ${session.userId}
              AND is_deleted = false
            FOR UPDATE`,
      );
      const ticket = ticketRows.rows[0];
      if (!ticket) throw new Error("TICKET_NOT_FOUND");
      if (ticket.ticket_type !== "PREMIUM_UNLOCK" || !ticket.course_id) {
        throw new Error("TICKET_TYPE_MISMATCH");
      }
      if (ticket.status === "USED") throw new Error("TICKET_ALREADY_USED");
      if (ticket.status === "REVOKED") throw new Error("TICKET_REVOKED");
      if (
        ticket.status === "EXPIRED" ||
        (ticket.expires_at && new Date(ticket.expires_at).getTime() <= now.getTime())
      ) {
        if (ticket.status === "AVAILABLE") {
          await tx
            .update(userTickets)
            .set({ status: "EXPIRED", updatedBy: session.userId })
            .where(eq(userTickets.id, Number(ticket.id)));
        }
        throw new Error("TICKET_EXPIRED");
      }

      const courseId = Number(ticket.course_id);
      const [course] = await tx
        .select({ id: courses.id, isPublished: courses.isPublished })
        .from(courses)
        .where(and(eq(courses.id, courseId), eq(courses.isDeleted, false)))
        .limit(1);
      if (!course || !course.isPublished) {
        throw new Error("COURSE_UNAVAILABLE");
      }

      const [alreadyUnlocked] = await tx
        .select({ id: courseUnlocks.id })
        .from(courseUnlocks)
        .where(
          and(
            eq(courseUnlocks.userId, session.userId),
            eq(courseUnlocks.courseId, courseId),
            eq(courseUnlocks.isDeleted, false),
          ),
        )
        .limit(1);
      if (alreadyUnlocked) {
        throw new Error("ALREADY_UNLOCKED");
      }

      let targetDogId = parsed.data.dogId;
      if (targetDogId) {
        const [owned] = await tx
          .select({ id: dogs.id })
          .from(dogs)
          .where(
            and(
              eq(dogs.id, targetDogId),
              eq(dogs.userId, session.userId),
              eq(dogs.isDeleted, false),
            ),
          )
          .limit(1);
        if (!owned) throw new Error("DOG_FORBIDDEN");
      } else {
        const [primaryDog] = await tx
          .select({ id: dogs.id })
          .from(dogs)
          .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
          .orderBy(desc(dogs.isPrimary), asc(dogs.id))
          .limit(1);
        if (!primaryDog) throw new Error("DOG_NOT_FOUND");
        targetDogId = primaryDog.id;
      }

      await tx
        .update(userTickets)
        .set({
          status: "USED",
          usedAt: now,
          usedRefId: courseId,
          usedDogId: targetDogId,
          updatedBy: session.userId,
        })
        .where(eq(userTickets.id, Number(ticket.id)));

      await tx.insert(courseUnlocks).values({
        userId: session.userId,
        courseId,
        orderId: ticket.order_id ? Number(ticket.order_id) : null,
        createdBy: session.userId,
      });

      const [existingEnr] = await tx
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.dogId, targetDogId),
            eq(enrollments.courseId, courseId),
            eq(enrollments.isDeleted, false),
          ),
        )
        .limit(1);
      if (!existingEnr) {
        await tx.insert(enrollments).values({
          dogId: targetDogId,
          courseId,
          status: "IN_PROGRESS",
          createdBy: session.userId,
        });
      }

      return { courseId, dogId: targetDogId };
    });

    revalidatePath("/app");
    revalidatePath("/app/record");
    revalidatePath(`/app/courses/${result.courseId}`);
    revalidatePath("/app/my");
    revalidatePath("/app/my/tickets");
    revalidatePath("/app/shop");
    revalidatePath("/app/shop/orders");
    return ok(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    if (code === "TICKET_NOT_FOUND") return fail("NOT_FOUND", "티켓을 찾을 수 없습니다.");
    if (code === "TICKET_TYPE_MISMATCH") return fail("VALIDATION_ERROR", "프리미엄 코스용 티켓이 아닙니다.");
    if (code === "TICKET_ALREADY_USED") return fail("CONFLICT", "이미 사용 완료된 티켓입니다.");
    if (code === "TICKET_REVOKED") return fail("CONFLICT", "취소된 티켓은 사용할 수 없습니다.");
    if (code === "TICKET_EXPIRED") return fail("CONFLICT", "유효기간이 만료된 티켓입니다.");
    if (code === "COURSE_UNAVAILABLE") return fail("NOT_FOUND", "현재 수강할 수 없는 코스입니다.");
    if (code === "ALREADY_UNLOCKED") return fail("CONFLICT", "이미 잠금 해제된 프리미엄 코스입니다.");
    if (code === "DOG_FORBIDDEN") return fail("FORBIDDEN", "본인 반려견만 선택할 수 있습니다.");
    if (code === "DOG_NOT_FOUND") return fail("NOT_FOUND", "먼저 반려견 프로필을 등록해 주세요.");
    return fail("INTERNAL_ERROR", "티켓 사용 처리 중 오류가 발생했습니다.");
  }
}

const unlockWithPointsSchema = z.object({
  courseId: z.coerce.number().int().positive(),
  dogId: z.coerce.number().int().positive().optional(),
  idempotencyKey: z.string().trim().min(8).max(100).optional(),
  expectedWalletBalance: z.coerce.number().int().min(0).optional(),
});

/**
 * 교육 화면에서 프리미엄 코스 바로 포인트 차감 잠금 해제
 * - 연동된 PREMIUM_UNLOCK 상품 재고 차감 + 포인트 차감 + 주문/사용완료 티켓(발도장) 발급 + 코스 해제 + 내 교육 등록
 */
export async function unlockPremiumCourseWithPointsAction(
  input: z.infer<typeof unlockWithPointsSchema>,
): Promise<ActionResult<{ courseId: number; orderNo: string; paidPoints: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = unlockWithPointsSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "유효하지 않은 코스 요청입니다.");
  }

  const db = getDb();
  let latestBalance: number | null = null;
  try {
    const result = await db.transaction(async (tx) => {
      // 전역 잠금 순서 1: point_wallets 먼저 잠금
      const wallet = await ensureWalletLocked(tx, session.userId);
      latestBalance = wallet.balance;

      if (parsed.data.idempotencyKey) {
        const [dup] = await tx
          .select({ id: orders.id, orderNo: orders.orderNo, paidPoints: orders.paidPoints })
          .from(orders)
          .where(
            and(
              eq(orders.idempotencyKey, parsed.data.idempotencyKey),
              eq(orders.userId, session.userId),
            ),
          )
          .limit(1);
        if (dup) {
          return { courseId: parsed.data.courseId, orderNo: dup.orderNo, paidPoints: dup.paidPoints };
        }
      }

      if (
        parsed.data.expectedWalletBalance !== undefined &&
        wallet.balance !== parsed.data.expectedWalletBalance
      ) {
        throw new Error("BALANCE_STALE");
      }

      const [course] = await tx
        .select({ id: courses.id, title: courses.title, isPremium: courses.isPremium, isPublished: courses.isPublished })
        .from(courses)
        .where(and(eq(courses.id, parsed.data.courseId), eq(courses.isDeleted, false)))
        .limit(1);
      if (!course || !course.isPublished || !course.isPremium) {
        throw new Error("COURSE_UNAVAILABLE");
      }

      const [alreadyUnlocked] = await tx
        .select({ id: courseUnlocks.id })
        .from(courseUnlocks)
        .where(
          and(
            eq(courseUnlocks.userId, session.userId),
            eq(courseUnlocks.courseId, course.id),
            eq(courseUnlocks.isDeleted, false),
          ),
        )
        .limit(1);
      if (alreadyUnlocked) throw new Error("ALREADY_UNLOCKED");

      let targetDogId = parsed.data.dogId;
      if (targetDogId) {
        const [owned] = await tx
          .select({ id: dogs.id })
          .from(dogs)
          .where(
            and(
              eq(dogs.id, targetDogId),
              eq(dogs.userId, session.userId),
              eq(dogs.isDeleted, false),
            ),
          )
          .limit(1);
        if (!owned) throw new Error("DOG_FORBIDDEN");
      } else {
        const [primaryDog] = await tx
          .select({ id: dogs.id })
          .from(dogs)
          .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
          .orderBy(desc(dogs.isPrimary), asc(dogs.id))
          .limit(1);
        if (!primaryDog) throw new Error("DOG_NOT_FOUND");
        targetDogId = primaryDog.id;
      }

      const prodRows = await tx.execute<{
        id: string;
        name: string;
        point_price: string;
        stock: number;
        status: string;
      }>(
        sql`SELECT id, name, point_price, stock, status
            FROM products
            WHERE linked_course_id = ${course.id}
              AND type = 'PREMIUM_UNLOCK'
              AND status = 'ACTIVE'
              AND is_deleted = false
            ORDER BY id ASC
            LIMIT 1
            FOR UPDATE`,
      );
      const prod = prodRows.rows[0];
      if (!prod) throw new Error("PRODUCT_UNAVAILABLE");
      if (prod.stock < 1) throw new Error("OUT_OF_STOCK");

      const pointPrice = Number(prod.point_price);
      await tx
        .update(products)
        .set({ stock: prod.stock - 1 })
        .where(eq(products.id, Number(prod.id)));

      const orderNo = `WGL${Date.now().toString().slice(-8)}${randomUUID().slice(0, 4).toUpperCase()}`;
      const now = new Date();

      await spendPointsFifoTx(tx, {
        userId: session.userId,
        amount: pointPrice,
        reason: "SPEND_COURSE_UNLOCK",
        idempotencyKey: `order:${orderNo}`,
        refType: "order",
        memo: `프리미엄 코스 즉시 잠금해제 (${course.title})`,
        actorId: session.userId,
      });

      const [order] = await tx
        .insert(orders)
        .values({
          orderNo,
          userId: session.userId,
          status: "DELIVERED",
          paidPoints: pointPrice,
          totalPoint: pointPrice,
          addressSnapshot: {
            receiver: session.nickname,
            phone: "-",
            zipcode: "-",
            addr1: "디지털 프리미엄 코스 즉시 잠금해제",
          },
          idempotencyKey: parsed.data.idempotencyKey ?? null,
          paidAt: now,
          createdBy: session.userId,
        })
        .returning();

      await tx.insert(orderItems).values({
        orderId: order!.id,
        productId: Number(prod.id),
        variantId: null,
        nameSnap: prod.name,
        productTypeSnap: "PREMIUM_UNLOCK",
        pointPrice,
        quantity: 1,
        createdBy: session.userId,
      });

      // 티켓함 이력에도 멍멍이 발도장(USED) 상태로 기록
      await tx.insert(userTickets).values({
        userId: session.userId,
        ticketType: "PREMIUM_UNLOCK",
        productId: Number(prod.id),
        orderId: order!.id,
        courseId: course.id,
        titleSnap: prod.name,
        status: "USED",
        expiresAt: null,
        usedAt: now,
        usedRefId: course.id,
        usedDogId: targetDogId,
        createdBy: session.userId,
      });

      await tx.insert(courseUnlocks).values({
        userId: session.userId,
        courseId: course.id,
        orderId: order!.id,
        createdBy: session.userId,
      });

      const [existingEnr] = await tx
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.dogId, targetDogId),
            eq(enrollments.courseId, course.id),
            eq(enrollments.isDeleted, false),
          ),
        )
        .limit(1);
      if (!existingEnr) {
        await tx.insert(enrollments).values({
          dogId: targetDogId,
          courseId: course.id,
          status: "IN_PROGRESS",
          createdBy: session.userId,
        });
      }

      await tx.insert(notifications).values({
        userId: session.userId,
        kind: "ORDER_UPDATE",
        title: "프리미엄 코스 잠금 해제 완료",
        body: `「${course.title}」 (${pointPrice.toLocaleString("ko-KR")}P 차감) 학습을 바로 시작할 수 있어요.`,
        deepLink: `/app/courses/${course.id}`,
      });

      return { courseId: course.id, orderNo, paidPoints: pointPrice };
    });

    revalidatePath("/app");
    revalidatePath("/app/record");
    revalidatePath(`/app/courses/${result.courseId}`);
    revalidatePath("/app/my");
    revalidatePath("/app/my/tickets");
    revalidatePath("/app/shop");
    revalidatePath("/app/shop/orders");
    revalidatePath("/app/wallet");
    return ok(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    if (code === "BALANCE_STALE") {
      return fail(
        "BALANCE_STALE",
        `다른 화면에서 보유 포인트가 변경되었습니다. 최신 잔액(${(latestBalance ?? 0).toLocaleString("ko-KR")}P)을 확인한 뒤 다시 진행해 주세요.`,
        undefined,
        latestBalance !== null ? { latestBalance } : undefined,
      );
    }
    if (code === "INSUFFICIENT_POINTS") {
      return fail("INSUFFICIENT_POINTS", "보유 포인트가 부족합니다. 지갑에서 충전 후 이용해 주세요.");
    }
    if (code === "ALREADY_UNLOCKED") return fail("CONFLICT", "이미 잠금 해제된 프리미엄 코스입니다.");
    if (code === "PRODUCT_UNAVAILABLE") return fail("NOT_FOUND", "연동된 프리미엄 상품을 찾을 수 없습니다.");
    if (code === "OUT_OF_STOCK") return fail("CONFLICT", "현재 판매가 일시 중단된 상품입니다.");
    if (code === "COURSE_UNAVAILABLE") return fail("NOT_FOUND", "잠금 해제할 수 없는 코스입니다.");
    if (code === "DOG_FORBIDDEN") return fail("FORBIDDEN", "본인 반려견만 선택할 수 있습니다.");
    if (code === "DOG_NOT_FOUND") return fail("NOT_FOUND", "먼저 반려견 프로필을 등록해 주세요.");
    return fail("INTERNAL_ERROR", "프리미엄 코스 잠금 해제 중 오류가 발생했습니다.");
  }
}
