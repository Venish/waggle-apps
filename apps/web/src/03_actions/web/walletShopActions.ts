"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addresses,
  and,
  asc,
  cartItems,
  carts,
  courseUnlocks,
  desc,
  dogs,
  enrollments,
  eq,
  getDb,
  notifications,
  orderItems,
  orders,
  pointLedgers,
  pointRecharges,
  pointWallets,
  productReviews,
  products,
  productVariants,
  shipments,
  sql,
  userTickets,
} from "@repo/db";
import { fail, ok, type ActionResult } from "@repo/types";
import { getCurrentUserSession } from "@/00_lib/session";
import {
  computeRechargeRefundMeta,
  ORDER_RETURN_WINDOW_MS,
  restoreOrderStockTx,
} from "@/04_services/shared/commerceRefundService";
import {
  earnPointsTx,
  ensureWalletLocked,
  revokeRechargeLedgerTx,
  spendPointsFifoTx,
} from "@/04_services/shared/pointLedgerService";
import {
  getRechargePackagesPolicy,
  getShopReviewPolicy,
} from "@/04_services/shared/policyService";

/** 1. 포인트 충전 주문 생성 (PENDING) — 전역 잠금 + 멱등키 + Stale 탭 잔액 대조 */
export async function createPointRechargeAction(input: {
  packageCode: string;
  channel?: "WEB_PG" | "IOS_IAP" | "ANDROID_IAP";
  idempotencyKey?: string;
  expectedWalletBalance?: number;
}): Promise<
  ActionResult<{
    rechargeId: number;
    paidAmount: number;
    pointAmount: number;
    paymentId: string;
    alreadyPaid?: boolean;
  }>
> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const packages = await getRechargePackagesPolicy();
  const pkg = packages.find((p) => p.code === input.packageCode);
  if (!pkg) return fail("NOT_FOUND", "유효하지 않은 충전 패키지입니다.");

  const channel = input.channel ?? "WEB_PG";
  const paidAmount = channel === "WEB_PG" ? pkg.webPrice : pkg.iapPrice;
  const trimmedKey = input.idempotencyKey?.trim() || undefined;
  const db = getDb();

  let latestBalance: number | null = null;
  try {
    const result = await db.transaction(async (tx) => {
      // 전역 잠금 순서 1: point_wallets FOR UPDATE 먼저 잠금
      const wallet = await ensureWalletLocked(tx, session.userId);
      latestBalance = wallet.balance;

      // 멱등키 중복 생성 차단 (연타/네트워크 재시도 시 기존 충전 주문 반환)
      if (trimmedKey) {
        const [existing] = await tx
          .select()
          .from(pointRecharges)
          .where(
            and(
              eq(pointRecharges.idempotencyKey, trimmedKey),
              eq(pointRecharges.userId, session.userId),
            ),
          )
          .limit(1);
        if (existing) {
          return {
            rechargeId: existing.id,
            paidAmount: existing.paidAmount,
            pointAmount: existing.pointAmount,
            paymentId: existing.paymentId ?? `pay_${existing.id}`,
            alreadyPaid: existing.status === "PAID" || existing.status === "REFUNDED",
          };
        }
      }

      // Stale 탭 차단: 다른 탭에서 이미 충전·결제로 잔액이 바뀐 상태에서 재충전 클릭 방지
      if (
        input.expectedWalletBalance !== undefined &&
        wallet.balance !== input.expectedWalletBalance
      ) {
        throw new Error("BALANCE_STALE");
      }

      const paymentId = `pay_${randomUUID().replace(/-/g, "").slice(0, 16)}_${session.userId}`;
      const [created] = await tx
        .insert(pointRecharges)
        .values({
          userId: session.userId,
          channel,
          packageCode: pkg.code,
          pointAmount: pkg.pointAmount,
          paidAmount,
          provider: channel === "WEB_PG" ? "portone" : channel === "IOS_IAP" ? "apple" : "google",
          paymentId,
          idempotencyKey: trimmedKey ?? null,
          status: "PENDING",
          createdBy: session.userId,
        })
        .returning();

      return {
        rechargeId: created!.id,
        paidAmount,
        pointAmount: pkg.pointAmount,
        paymentId,
        alreadyPaid: false,
      };
    });

    return ok(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    if (code === "BALANCE_STALE") {
      return fail(
        "BALANCE_STALE",
        `다른 화면에서 이미 포인트가 변경되었습니다. 최신 잔액(${(latestBalance ?? 0).toLocaleString("ko-KR")}P)을 확인한 뒤 다시 충전해 주세요.`,
        undefined,
        latestBalance !== null ? { latestBalance } : undefined,
      );
    }
    return fail("INTERNAL_ERROR", "충전 주문 생성 중 오류가 발생했습니다.");
  }
}

/** 2. 장바구니 담기 */
export async function addToCartAction(input: {
  productId: number;
  variantId?: number | null;
  quantity?: number;
}): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const qty = Math.max(1, Math.min(99, input.quantity ?? 1));
  const db = getDb();

  const [prod] = await db
    .select({ id: products.id, type: products.type, linkedCourseId: products.linkedCourseId, status: products.status })
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.isDeleted, false)))
    .limit(1);
  if (!prod || prod.status !== "ACTIVE") {
    return fail("NOT_FOUND", "현재 구매할 수 없는 상품입니다.");
  }

  if (prod.type === "PREMIUM_UNLOCK" && prod.linkedCourseId) {
    const [[unlocked], [ticket]] = await Promise.all([
      db
        .select({ id: courseUnlocks.id })
        .from(courseUnlocks)
        .where(
          and(
            eq(courseUnlocks.userId, session.userId),
            eq(courseUnlocks.courseId, prod.linkedCourseId),
            eq(courseUnlocks.isDeleted, false),
          ),
        )
        .limit(1),
      db
        .select({ id: userTickets.id })
        .from(userTickets)
        .where(
          and(
            eq(userTickets.userId, session.userId),
            eq(userTickets.courseId, prod.linkedCourseId),
            eq(userTickets.status, "AVAILABLE"),
            eq(userTickets.isDeleted, false),
          ),
        )
        .limit(1),
    ]);
    if (unlocked) return fail("CONFLICT", "이미 잠금 해제된 프리미엄 코스입니다.");
    if (ticket) {
      return fail("CONFLICT", "이미 보유 중인 프리미엄 코스 티켓이 있습니다. 내 티켓함을 확인해 주세요.");
    }
  }

  const isSingleQty = prod.type === "PREMIUM_UNLOCK";
  const effectiveQty = isSingleQty ? 1 : qty;

  await db.transaction(async (tx) => {
    let [cart] = await tx
      .select()
      .from(carts)
      .where(and(eq(carts.userId, session.userId), eq(carts.isDeleted, false)))
      .limit(1);

    if (!cart) {
      const [created] = await tx
        .insert(carts)
        .values({ userId: session.userId, createdBy: session.userId })
        .returning();
      cart = created!;
    }

    const existingItems = await tx
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cart.id),
          eq(cartItems.productId, input.productId),
          eq(cartItems.isDeleted, false),
        ),
      );
    const matched = existingItems.find((i) => (i.variantId ?? null) === (input.variantId ?? null));

    if (matched) {
      await tx
        .update(cartItems)
        .set({
          quantity: isSingleQty ? 1 : matched.quantity + effectiveQty,
          updatedBy: session.userId,
        })
        .where(eq(cartItems.id, matched.id));
    } else {
      await tx.insert(cartItems).values({
        cartId: cart.id,
        productId: input.productId,
        variantId: input.variantId ?? null,
        quantity: effectiveQty,
        createdBy: session.userId,
      });
    }
  });

  revalidatePath("/app/shop/cart");
  return ok({ ok: true });
}

export async function updateCartItemQtyAction(
  cartItemId: number,
  quantity: number,
): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const db = getDb();
  const [cart] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.userId, session.userId), eq(carts.isDeleted, false)))
    .limit(1);
  if (!cart) return fail("NOT_FOUND", "장바구니를 찾을 수 없습니다.");

  if (quantity <= 0) {
    await db
      .update(cartItems)
      .set({ isDeleted: true, deletedAt: new Date(), deletedBy: session.userId })
      .where(and(eq(cartItems.id, cartItemId), eq(cartItems.cartId, cart.id)));
  } else {
    await db
      .update(cartItems)
      .set({ quantity: Math.min(99, quantity), updatedBy: session.userId })
      .where(and(eq(cartItems.id, cartItemId), eq(cartItems.cartId, cart.id)));
  }

  revalidatePath("/app/shop/cart");
  return ok({ ok: true });
}

const checkoutSchema = z.object({
  receiver: z.string().optional(),
  phone: z.string().optional(),
  zipcode: z.string().optional(),
  addr1: z.string().optional(),
  addr2: z.string().optional(),
  directProductId: z.coerce.number().int().positive().optional(),
  directVariantId: z.coerce.number().int().positive().nullable().optional(),
  directQuantity: z.coerce.number().int().positive().optional(),
  idempotencyKey: z.string().trim().min(8).max(100).optional(),
  expectedWalletBalance: z.coerce.number().int().min(0).optional(),
});

export interface IssuedTicketSummary {
  id: number;
  ticketType: "PREMIUM_UNLOCK" | "INQUIRY_TICKET";
  courseId: number | null;
  title: string;
}

/** 3. 포인트샵 주문 생성 (전역 잠금 순서: wallet → cart → products(ASC) → ledgers + 멱등키 + Stale 대조) */
export async function createShopOrderAction(
  input: z.infer<typeof checkoutSchema>,
): Promise<ActionResult<{ orderId: number; orderNo: string; issuedTickets: IssuedTicketSummary[] }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "배송 정보를 확인해 주세요.");
  }

  const db = getDb();
  let latestBalance: number | null = null;

  try {
    const orderResult = await db.transaction(async (tx) => {
      // 전역 잠금 순서 1: point_wallets FOR UPDATE 먼저 잠금 (다중 탭·동시 거래 직렬화)
      const wallet = await ensureWalletLocked(tx, session.userId);
      latestBalance = wallet.balance;

      // 멱등키 중복 주문 차단 (연타/네트워크 재전송 시 기존 주문 반환)
      if (parsed.data.idempotencyKey) {
        const [dupOrder] = await tx
          .select({ id: orders.id, orderNo: orders.orderNo })
          .from(orders)
          .where(
            and(
              eq(orders.idempotencyKey, parsed.data.idempotencyKey),
              eq(orders.userId, session.userId),
            ),
          )
          .limit(1);
        if (dupOrder) {
          const dupTickets = await tx
            .select({
              id: userTickets.id,
              ticketType: userTickets.ticketType,
              courseId: userTickets.courseId,
              title: userTickets.titleSnap,
            })
            .from(userTickets)
            .where(and(eq(userTickets.orderId, dupOrder.id), eq(userTickets.isDeleted, false)));
          return { orderId: dupOrder.id, orderNo: dupOrder.orderNo, issuedTickets: dupTickets };
        }
      }

      // Stale 탭 차단: 화면 로드 시점 잔액과 실제 DB 잔액 대조
      if (
        parsed.data.expectedWalletBalance !== undefined &&
        wallet.balance !== parsed.data.expectedWalletBalance
      ) {
        throw new Error("BALANCE_STALE");
      }

      // 주문 대상 아이템 구성
      let targetItems: Array<{ productId: number; variantId: number | null; quantity: number }> = [];
      let cartIdToClear: number | null = null;

      if (parsed.data.directProductId) {
        targetItems = [
          {
            productId: parsed.data.directProductId,
            variantId: parsed.data.directVariantId ?? null,
            quantity: parsed.data.directQuantity ?? 1,
          },
        ];
      } else {
        // 전역 잠금 순서 2: carts 행 FOR UPDATE 잠금 (2탭 장바구니 동시 결제 원천 차단)
        const cartRows = await tx.execute<{ id: string }>(
          sql`SELECT id FROM carts WHERE user_id = ${session.userId} AND is_deleted = false FOR UPDATE`,
        );
        const lockedCartId = cartRows.rows[0] ? Number(cartRows.rows[0].id) : null;
        if (!lockedCartId) throw new Error("EMPTY_CART");
        cartIdToClear = lockedCartId;
        const cItems = await tx
          .select()
          .from(cartItems)
          .where(and(eq(cartItems.cartId, lockedCartId), eq(cartItems.isDeleted, false)));
        if (cItems.length === 0) throw new Error("EMPTY_CART");
        targetItems = cItems.map((ci) => ({
          productId: ci.productId,
          variantId: ci.variantId,
          quantity: ci.quantity,
        }));
      }

      // 전역 잠금 순서 3: products/variants ID 오름차순 정렬 후 FOR UPDATE (교차 상품 데드락 차단)
      targetItems.sort(
        (a, b) => a.productId - b.productId || (a.variantId ?? 0) - (b.variantId ?? 0),
      );

      // 재고 검증 & 합계 포인트 계산
      let totalPoint = 0;
      let hasPhysical = false;
      const resolvedItems: Array<{
        productId: number;
        variantId: number | null;
        nameSnap: string;
        productTypeSnap: "PHYSICAL" | "INQUIRY_TICKET" | "PREMIUM_UNLOCK";
        pointPrice: number;
        quantity: number;
        linkedCourseId: number | null;
      }> = [];

      for (const item of targetItems) {
        const prodRows = await tx.execute<{
          id: string;
          name: string;
          type: "PHYSICAL" | "INQUIRY_TICKET" | "PREMIUM_UNLOCK";
          status: string;
          point_price: string;
          stock: number;
          linked_course_id: string | null;
        }>(
          sql`SELECT id, name, type, status, point_price, stock, linked_course_id FROM products WHERE id = ${item.productId} AND is_deleted = false FOR UPDATE`,
        );
        const prod = prodRows.rows[0];
        if (!prod || prod.status !== "ACTIVE") {
          throw new Error("PRODUCT_UNAVAILABLE");
        }

        const linkedCourseId = prod.linked_course_id ? Number(prod.linked_course_id) : null;
        // 이미 잠금 해제되었거나 미사용 티켓 보유 중인 프리미엄 코스 중복 결제 차단
        if (prod.type === "PREMIUM_UNLOCK" && linkedCourseId) {
          if (item.quantity > 1) {
            throw new Error("PREMIUM_SINGLE_QTY");
          }
          const [alreadyUnlocked] = await tx
            .select({ id: courseUnlocks.id })
            .from(courseUnlocks)
            .where(
              and(
                eq(courseUnlocks.userId, session.userId),
                eq(courseUnlocks.courseId, linkedCourseId),
                eq(courseUnlocks.isDeleted, false),
              ),
            )
            .limit(1);
          if (alreadyUnlocked) {
            throw new Error("ALREADY_UNLOCKED");
          }
          const [existingTicket] = await tx
            .select({ id: userTickets.id })
            .from(userTickets)
            .where(
              and(
                eq(userTickets.userId, session.userId),
                eq(userTickets.courseId, linkedCourseId),
                eq(userTickets.status, "AVAILABLE"),
                eq(userTickets.isDeleted, false),
              ),
            )
            .limit(1);
          if (existingTicket) {
            throw new Error("ALREADY_HAS_TICKET");
          }
        }

        let unitPoint = Number(prod.point_price);
        let nameSnap = prod.name;

        if (item.variantId) {
          const varRows = await tx.execute<{
            id: string;
            name: string;
            add_point: string;
            stock: number;
          }>(
            sql`SELECT id, name, add_point, stock FROM product_variants WHERE id = ${item.variantId} AND product_id = ${item.productId} AND is_deleted = false FOR UPDATE`,
          );
          const v = varRows.rows[0];
          if (!v || v.stock < item.quantity) throw new Error("OUT_OF_STOCK");
          unitPoint += Number(v.add_point);
          nameSnap = `${prod.name} (${v.name})`;
          await tx
            .update(productVariants)
            .set({ stock: v.stock - item.quantity })
            .where(eq(productVariants.id, Number(v.id)));
        } else {
          if (prod.stock < item.quantity) throw new Error("OUT_OF_STOCK");
          await tx
            .update(products)
            .set({ stock: prod.stock - item.quantity })
            .where(eq(products.id, Number(prod.id)));
        }

        if (prod.type === "PHYSICAL") hasPhysical = true;
        totalPoint += unitPoint * item.quantity;
        resolvedItems.push({
          productId: Number(prod.id),
          variantId: item.variantId,
          nameSnap,
          productTypeSnap: prod.type,
          pointPrice: unitPoint,
          quantity: item.quantity,
          linkedCourseId,
        });
      }

      const orderNo = `WGL${Date.now().toString().slice(-8)}${randomUUID().slice(0, 4).toUpperCase()}`;

      // FIFO 포인트 원장 차감 (잔액 부족 시 롤백)
      await spendPointsFifoTx(tx, {
        userId: session.userId,
        amount: totalPoint,
        reason: resolvedItems.every((i) => i.productTypeSnap === "PREMIUM_UNLOCK")
          ? "SPEND_COURSE_UNLOCK"
          : "SPEND_SHOP",
        idempotencyKey: `order:${orderNo}`,
        refType: "order",
        memo: `포인트샵 주문 (${orderNo})`,
        actorId: session.userId,
      });

      const receiver = parsed.data.receiver?.trim() ?? "";
      const phone = parsed.data.phone?.trim() ?? "";
      const zipcode = parsed.data.zipcode?.trim() ?? "";
      const addr1 = parsed.data.addr1?.trim() ?? "";
      const addr2 = parsed.data.addr2?.trim() || "";

      if (hasPhysical) {
        if (receiver.length < 1 || phone.length < 8 || zipcode.length < 4 || addr1.length < 2) {
          throw new Error("ADDRESS_REQUIRED");
        }
      }

      const [order] = await tx
        .insert(orders)
        .values({
          orderNo,
          userId: session.userId,
          status: hasPhysical ? "PAID" : "DELIVERED",
          paidPoints: totalPoint,
          totalPoint,
          addressSnapshot: hasPhysical
            ? {
                receiver,
                phone,
                zipcode,
                addr1,
                addr2: addr2 || undefined,
              }
            : {
                receiver: session.nickname,
                phone: "-",
                zipcode: "-",
                addr1: "디지털 티켓 발급",
              },
          idempotencyKey: parsed.data.idempotencyKey ?? null,
          paidAt: new Date(),
          createdBy: session.userId,
        })
        .returning();

      // 실물 배송 주문일 때만 기본 배송지 저장
      if (hasPhysical) {
        await tx
          .update(addresses)
          .set({ isDefault: false, updatedBy: session.userId })
          .where(and(eq(addresses.userId, session.userId), eq(addresses.isDefault, true)));

        await tx.insert(addresses).values({
          userId: session.userId,
          receiver,
          phone,
          zipcode,
          addr1,
          addr2: addr2 || null,
          isDefault: true,
          createdBy: session.userId,
        });
      }

      const issuedTickets: IssuedTicketSummary[] = [];

      for (const ri of resolvedItems) {
        await tx.insert(orderItems).values({
          orderId: order!.id,
          productId: ri.productId,
          variantId: ri.variantId,
          nameSnap: ri.nameSnap,
          productTypeSnap: ri.productTypeSnap,
          pointPrice: ri.pointPrice,
          quantity: ri.quantity,
          createdBy: session.userId,
        });

        // 디지털 상품(PREMIUM_UNLOCK / INQUIRY_TICKET)은 내 티켓함(user_tickets)에 미사용(AVAILABLE) 발급
        if (ri.productTypeSnap === "PREMIUM_UNLOCK" && ri.linkedCourseId) {
          const [createdTicket] = await tx
            .insert(userTickets)
            .values({
              userId: session.userId,
              ticketType: "PREMIUM_UNLOCK",
              productId: ri.productId,
              orderId: order!.id,
              courseId: ri.linkedCourseId,
              titleSnap: ri.nameSnap,
              status: "AVAILABLE",
              expiresAt: null,
              createdBy: session.userId,
            })
            .returning({
              id: userTickets.id,
              ticketType: userTickets.ticketType,
              courseId: userTickets.courseId,
              title: userTickets.titleSnap,
            });
          if (createdTicket) issuedTickets.push(createdTicket);
        } else if (ri.productTypeSnap === "INQUIRY_TICKET") {
          for (let q = 0; q < ri.quantity; q++) {
            const [createdTicket] = await tx
              .insert(userTickets)
              .values({
                userId: session.userId,
                ticketType: "INQUIRY_TICKET",
                productId: ri.productId,
                orderId: order!.id,
                courseId: null,
                titleSnap: ri.nameSnap,
                status: "AVAILABLE",
                expiresAt: null,
                createdBy: session.userId,
              })
              .returning({
                id: userTickets.id,
                ticketType: userTickets.ticketType,
                courseId: userTickets.courseId,
                title: userTickets.titleSnap,
              });
            if (createdTicket) issuedTickets.push(createdTicket);
          }
        }
      }

      if (hasPhysical) {
        await tx.insert(shipments).values({
          orderId: order!.id,
          status: "READY",
          createdBy: session.userId,
        });
      }

      if (cartIdToClear) {
        await tx
          .update(cartItems)
          .set({ isDeleted: true, deletedAt: new Date(), deletedBy: session.userId })
          .where(and(eq(cartItems.cartId, cartIdToClear), eq(cartItems.isDeleted, false)));
      }

      await tx.insert(notifications).values({
        userId: session.userId,
        kind: "ORDER_UPDATE",
        title: `주문 완료 (${orderNo})`,
        body:
          issuedTickets.length > 0
            ? `${totalPoint.toLocaleString("ko-KR")}P 결제가 완료되어 티켓 ${issuedTickets.length}장이 발급되었습니다.`
            : `${totalPoint.toLocaleString("ko-KR")}P 결제가 완료되었습니다.`,
        deepLink: issuedTickets.length > 0 ? "/app/my/tickets" : "/app/shop/orders",
      });

      return { orderId: order!.id, orderNo, issuedTickets };
    });

    revalidatePath("/app");
    revalidatePath("/app/record");
    revalidatePath("/app/my");
    revalidatePath("/app/my/tickets");
    revalidatePath("/app/shop");
    revalidatePath("/app/shop/cart");
    revalidatePath("/app/shop/orders");
    revalidatePath("/app/wallet");
    revalidatePath("/app/courses");
    return ok(orderResult);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    if (code === "BALANCE_STALE") {
      return fail(
        "BALANCE_STALE",
        `다른 화면에서 보유 포인트가 변경되었습니다. 최신 잔액(${(latestBalance ?? 0).toLocaleString("ko-KR")}P)을 확인한 뒤 다시 결제해 주세요.`,
        undefined,
        latestBalance !== null ? { latestBalance } : undefined,
      );
    }
    if (code === "ADDRESS_REQUIRED") {
      return fail("VALIDATION_ERROR", "실물 상품 배송을 위해 배송지 정보를 모두 입력해 주세요.");
    }
    if (code === "ALREADY_UNLOCKED") {
      return fail("CONFLICT", "이미 잠금 해제된 프리미엄 코스입니다.");
    }
    if (code === "ALREADY_HAS_TICKET") {
      return fail(
        "CONFLICT",
        "이미 보유 중인 프리미엄 코스 티켓이 있습니다. 내 티켓함 또는 해당 코스에서 바로 사용해 주세요.",
      );
    }
    if (code === "PREMIUM_SINGLE_QTY") {
      return fail("VALIDATION_ERROR", "프리미엄 코스 해제권은 1장만 구매할 수 있습니다.");
    }
    if (code === "INSUFFICIENT_POINTS") {
      return fail("INSUFFICIENT_POINTS", "보유 포인트가 부족합니다. 지갑에서 충전 후 이용해 주세요.");
    }
    if (code === "OUT_OF_STOCK") {
      return fail("CONFLICT", "상품 재고가 부족합니다.");
    }
    if (code === "EMPTY_CART") {
      return fail("VALIDATION_ERROR", "장바구니가 비어 있거나 이미 결제가 완료되었습니다.");
    }
    return fail("INTERNAL_ERROR", "주문 처리 중 오류가 발생했습니다.");
  }
}

/** 4. 사용자 주문 즉시 취소 (배송 전 PAID 상태만 가능, 원본 paidPoints 전액 환불 + 재고 복구) */
export async function cancelMyOrderAction(
  orderId: number,
): Promise<ActionResult<{ refundedPoints: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const db = getDb();
  try {
    const refundedPoints = await db.transaction(async (tx) => {
      // 전역 잠금 순서 1: point_wallets 먼저 잠금
      await ensureWalletLocked(tx, session.userId);

      const [order] = await tx
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, orderId),
            eq(orders.userId, session.userId),
            eq(orders.isDeleted, false),
          ),
        )
        .limit(1);

      if (!order) throw new Error("ORDER_NOT_FOUND");

      // 연결된 티켓 중 이미 사용 완료(USED)된 건이 있으면 즉시 취소 불가
      const linkedTickets = await tx
        .select({ id: userTickets.id, status: userTickets.status })
        .from(userTickets)
        .where(and(eq(userTickets.orderId, order.id), eq(userTickets.isDeleted, false)));
      if (linkedTickets.some((t) => t.status === "USED")) {
        throw new Error("TICKET_ALREADY_USED");
      }

      const itemsOfOrder = await tx
        .select({ productTypeSnap: orderItems.productTypeSnap })
        .from(orderItems)
        .where(and(eq(orderItems.orderId, order.id), eq(orderItems.isDeleted, false)));
      const isDigitalOnlyUnused =
        itemsOfOrder.length > 0 &&
        itemsOfOrder.every((it) => it.productTypeSnap !== "PHYSICAL") &&
        linkedTickets.length > 0;

      if (
        order.status !== "PAID" &&
        order.status !== "PENDING" &&
        !(order.status === "DELIVERED" && isDigitalOnlyUnused)
      ) {
        throw new Error("ORDER_CANCEL_NOT_ALLOWED");
      }

      const [updated] = await tx
        .update(orders)
        .set({
          status: "CANCELLED",
          cancelReason: "사용자 즉시 취소",
          adminRejectReason: null,
          cancelledAt: new Date(),
          refundedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
        .returning({ id: orders.id });

      if (!updated) throw new Error("ORDER_CANCEL_NOT_ALLOWED");

      await restoreOrderStockTx(tx, order.id, session.userId);

      if (order.paidPoints > 0) {
        await earnPointsTx(tx, {
          userId: session.userId,
          amount: order.paidPoints,
          reason: "REFUND",
          idempotencyKey: `order-refund:${order.id}`,
          refType: "order",
          refId: order.id,
          memo: `주문(${order.orderNo}) 취소 전액 환불`,
          actorId: session.userId,
        });
      }

      await tx.insert(notifications).values({
        userId: session.userId,
        kind: "ORDER_UPDATE",
        title: `주문 취소 완료 (${order.orderNo})`,
        body: `${order.paidPoints.toLocaleString("ko-KR")}P가 포인트 지갑으로 환불되었습니다.`,
        deepLink: "/app/shop/orders",
      });

      return order.paidPoints;
    });

    revalidatePath("/app");
    revalidatePath("/app/record");
    revalidatePath("/app/my");
    revalidatePath("/app/my/tickets");
    revalidatePath("/app/shop");
    revalidatePath("/app/shop/orders");
    revalidatePath("/app/wallet");
    revalidatePath("/admin/orders");
    return ok({ refundedPoints });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    if (code === "ORDER_NOT_FOUND") return fail("NOT_FOUND", "주문을 찾을 수 없습니다.");
    if (code === "TICKET_ALREADY_USED") {
      return fail("CONFLICT", "이미 사용 완료된 티켓이 포함된 주문은 즉시 취소할 수 없습니다.");
    }
    if (code === "ORDER_CANCEL_NOT_ALLOWED") {
      return fail("CONFLICT", "배송 준비 중이거나 완료된 주문은 즉시 취소할 수 없습니다. 취소/반품 신청을 이용해 주세요.");
    }
    return fail("INTERNAL_ERROR", "주문 취소 처리 중 오류가 발생했습니다.");
  }
}

const orderAddressUpdateSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  receiver: z.string().trim().min(1, "수령인을 입력해 주세요.").max(60),
  phone: z.string().trim().min(8, "연락처를 입력해 주세요.").max(30),
  zipcode: z.string().trim().min(4, "우편번호를 입력해 주세요.").max(16),
  addr1: z.string().trim().min(2, "기본 주소를 입력해 주세요.").max(200),
  addr2: z.string().trim().max(200).optional(),
  saveAsDefault: z.boolean().optional(),
});

/** 5. 사용자 주문 배송지 변경 (결제 완료 PAID + 실물 주문만 허용) */
export async function updateMyOrderAddressAction(
  input: z.infer<typeof orderAddressUpdateSchema>,
): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = orderAddressUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "배송지 정보를 확인해 주세요.");
  }

  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, parsed.data.orderId),
            eq(orders.userId, session.userId),
            eq(orders.isDeleted, false),
          ),
        )
        .limit(1);

      if (!order) throw new Error("ORDER_NOT_FOUND");
      if (order.status !== "PAID") throw new Error("ADDRESS_LOCKED");

      const [ship] = await tx
        .select({ id: shipments.id, trackingNo: shipments.trackingNo })
        .from(shipments)
        .where(and(eq(shipments.orderId, order.id), eq(shipments.isDeleted, false)))
        .limit(1);

      if (!ship) throw new Error("NON_PHYSICAL_ORDER");
      if (ship.trackingNo) throw new Error("ADDRESS_LOCKED");

      const nextSnapshot = {
        receiver: parsed.data.receiver,
        phone: parsed.data.phone,
        zipcode: parsed.data.zipcode,
        addr1: parsed.data.addr1,
        addr2: parsed.data.addr2 || undefined,
      };

      const [updated] = await tx
        .update(orders)
        .set({
          addressSnapshot: nextSnapshot,
          updatedBy: session.userId,
        })
        .where(and(eq(orders.id, order.id), eq(orders.status, "PAID")))
        .returning({ id: orders.id });

      if (!updated) throw new Error("ADDRESS_LOCKED");

      if (parsed.data.saveAsDefault) {
        await tx
          .update(addresses)
          .set({ isDefault: false, updatedBy: session.userId })
          .where(and(eq(addresses.userId, session.userId), eq(addresses.isDefault, true)));

        await tx.insert(addresses).values({
          userId: session.userId,
          receiver: parsed.data.receiver,
          phone: parsed.data.phone,
          zipcode: parsed.data.zipcode,
          addr1: parsed.data.addr1,
          addr2: parsed.data.addr2 || null,
          isDefault: true,
          createdBy: session.userId,
        });
      }
    });

    revalidatePath("/app/shop/orders");
    revalidatePath("/app/shop/checkout");
    revalidatePath("/admin/orders");
    return ok({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    if (code === "ORDER_NOT_FOUND") return fail("NOT_FOUND", "주문을 찾을 수 없습니다.");
    if (code === "NON_PHYSICAL_ORDER") return fail("CONFLICT", "배송 상품 주문만 배송지를 변경할 수 있습니다.");
    if (code === "ADDRESS_LOCKED") {
      return fail("CONFLICT", "배송 준비가 시작된 주문은 배송지를 변경할 수 없습니다.");
    }
    return fail("INTERNAL_ERROR", "배송지 변경 중 오류가 발생했습니다.");
  }
}

const orderRequestSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  reason: z.string().trim().min(2, "신청 사유를 2자 이상 입력해 주세요.").max(300),
});

/** 6. 사용자 주문 취소 신청 (PREPARING) 또는 반품·환불 신청 (DELIVERED 실물 7일 이내) */
export async function requestOrderCancelOrReturnAction(
  input: z.infer<typeof orderRequestSchema>,
): Promise<ActionResult<{ nextStatus: "CANCEL_REQUESTED" | "RETURN_REQUESTED" }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = orderRequestSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "신청 사유를 입력해 주세요.");
  }

  const db = getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, parsed.data.orderId),
        eq(orders.userId, session.userId),
        eq(orders.isDeleted, false),
      ),
    )
    .limit(1);

  if (!order) return fail("NOT_FOUND", "주문을 찾을 수 없습니다.");

  let nextStatus: "CANCEL_REQUESTED" | "RETURN_REQUESTED";
  if (order.status === "PREPARING") {
    nextStatus = "CANCEL_REQUESTED";
  } else if (order.status === "DELIVERED") {
    const [ship] = await db
      .select({ id: shipments.id, deliveredAt: shipments.deliveredAt })
      .from(shipments)
      .where(and(eq(shipments.orderId, order.id), eq(shipments.isDeleted, false)))
      .limit(1);

    if (!ship) {
      return fail("CONFLICT", "디지털 상품 주문은 고객센터를 통해 환불 문의를 진행해 주세요.");
    }
    const baseTime = (ship.deliveredAt ?? order.updatedAt).getTime();
    if (Date.now() - baseTime > ORDER_RETURN_WINDOW_MS) {
      return fail("CONFLICT", "배송 완료 후 7일이 경과하여 반품 신청이 불가능합니다.");
    }
    nextStatus = "RETURN_REQUESTED";
  } else {
    return fail("CONFLICT", "현재 주문 상태에서는 취소·반품 신청을 접수할 수 없습니다.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: nextStatus,
        cancelReason: parsed.data.reason,
        adminRejectReason: null,
        updatedBy: session.userId,
      })
      .where(and(eq(orders.id, order.id), eq(orders.status, order.status)));

    await tx.insert(notifications).values({
      userId: session.userId,
      kind: "ORDER_UPDATE",
      title:
        nextStatus === "CANCEL_REQUESTED"
          ? `주문 취소 신청 접수 (${order.orderNo})`
          : `반품 · 환불 신청 접수 (${order.orderNo})`,
      body: "운영팀 확인 후 승인 시 포인트가 환불됩니다.",
      deepLink: "/app/shop/orders",
    });
  });

  revalidatePath("/app/shop/orders");
  revalidatePath("/admin/orders");
  return ok({ nextStatus });
}

/** 7. 사용자 취소/반품 요청 철회 */
export async function withdrawOrderRequestAction(
  orderId: number,
): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const db = getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, session.userId), eq(orders.isDeleted, false)))
    .limit(1);

  if (!order) return fail("NOT_FOUND", "주문을 찾을 수 없습니다.");
  if (order.status !== "CANCEL_REQUESTED" && order.status !== "RETURN_REQUESTED") {
    return fail("CONFLICT", "철회할 수 있는 신청 상태가 아닙니다.");
  }

  const revertStatus = order.status === "CANCEL_REQUESTED" ? "PREPARING" : "DELIVERED";
  await db
    .update(orders)
    .set({
      status: revertStatus,
      cancelReason: null,
      updatedBy: session.userId,
    })
    .where(and(eq(orders.id, order.id), eq(orders.status, order.status)));

  revalidatePath("/app/shop/orders");
  revalidatePath("/admin/orders");
  return ok({ ok: true });
}

/** 8. 포인트 충전 미사용 7일 이내 즉시 취소 (GM-103: WEB_PG 전액 취소) */
export async function cancelMyRechargeAction(
  rechargeId: number,
): Promise<ActionResult<{ refundedPoints: number; refundedCash: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const db = getDb();
  try {
    const result = await db.transaction(async (tx) => {
      // 전역 잠금 순서 1: point_wallets 먼저 잠금
      const lockedWallet = await ensureWalletLocked(tx, session.userId);

      // 전역 잠금 순서 2: point_recharges 행 FOR UPDATE 잠금
      const rechargeRows = await tx.execute<{
        id: string;
        user_id: string;
        channel: "WEB_PG" | "IOS_IAP" | "ANDROID_IAP";
        package_code: string | null;
        point_amount: string;
        paid_amount: string;
        status: string;
        paid_at: string | Date | null;
      }>(
        sql`SELECT id, user_id, channel, package_code, point_amount, paid_amount, status, paid_at
            FROM point_recharges
            WHERE id = ${rechargeId} AND user_id = ${session.userId} AND is_deleted = false
            FOR UPDATE`,
      );
      const rawRec = rechargeRows.rows[0];
      if (!rawRec) throw new Error("RECHARGE_NOT_FOUND");
      const recharge = {
        id: Number(rawRec.id),
        channel: rawRec.channel,
        packageCode: rawRec.package_code,
        pointAmount: Number(rawRec.point_amount),
        paidAmount: Number(rawRec.paid_amount),
        status: rawRec.status,
        paidAt: rawRec.paid_at ? new Date(rawRec.paid_at) : null,
      };
      if (recharge.status !== "PAID") throw new Error("RECHARGE_NOT_PAID");
      if (recharge.channel !== "WEB_PG") throw new Error("IAP_STORE_ONLY");

      const originRows = await tx.execute<{ remaining_amount: string }>(
        sql`SELECT remaining_amount
            FROM point_ledgers
            WHERE user_id = ${session.userId}
              AND reason = 'EARN_RECHARGE'
              AND ref_type = 'recharge'
              AND ref_id = ${recharge.id}
            ORDER BY id ASC
            LIMIT 1
            FOR UPDATE`,
      );

      const meta = computeRechargeRefundMeta({
        status: recharge.status,
        channel: recharge.channel,
        pointAmount: recharge.pointAmount,
        paidAmount: recharge.paidAmount,
        paidAt: recharge.paidAt,
        remainingAmount: Number(originRows.rows[0]?.remaining_amount ?? 0),
        walletBalance: lockedWallet.balance,
      });

      if (meta.actionMode !== "INSTANT_CANCEL") {
        throw new Error("INSTANT_CANCEL_NOT_ELIGIBLE");
      }

      // 원장 회수 + point_wallets 잠금(FOR UPDATE) 및 차감
      await revokeRechargeLedgerTx(tx, {
        userId: session.userId,
        rechargeId: recharge.id,
        amount: recharge.pointAmount,
        idempotencyKey: `recharge-refund:${recharge.id}`,
        memo: `포인트 충전(${recharge.packageCode ?? `#${recharge.id}`}) 7일 이내 미사용 취소`,
        actorId: session.userId,
      });

      const [updated] = await tx
        .update(pointRecharges)
        .set({
          status: "REFUNDED",
          refundedAt: new Date(),
          refundReason: "사용자 7일 이내 미사용 즉시 취소",
          refundedPointAmount: recharge.pointAmount,
          refundedCashAmount: recharge.paidAmount,
          adminRejectReason: null,
          updatedBy: session.userId,
        })
        .where(and(eq(pointRecharges.id, recharge.id), eq(pointRecharges.status, "PAID")))
        .returning({ id: pointRecharges.id });

      if (!updated) throw new Error("RECHARGE_NOT_PAID");

      await tx.insert(notifications).values({
        userId: session.userId,
        kind: "NOTICE",
        title: `포인트 충전 취소 완료 (${recharge.paidAmount.toLocaleString("ko-KR")}원)`,
        body: `${recharge.pointAmount.toLocaleString("ko-KR")}P 회수 및 결제 취소가 완료되었습니다.`,
        deepLink: "/app/wallet",
      });

      return { refundedPoints: recharge.pointAmount, refundedCash: recharge.paidAmount };
    });

    revalidatePath("/app/wallet");
    revalidatePath("/app/shop");
    revalidatePath("/admin/recharges");
    return ok(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    if (code === "RECHARGE_NOT_FOUND") return fail("NOT_FOUND", "충전 내역을 찾을 수 없습니다.");
    if (code === "IAP_STORE_ONLY") {
      return fail("CONFLICT", "앱스토어/플레이스토어 인앱결제는 해당 스토어에서 환불을 진행해 주세요.");
    }
    if (code === "INSTANT_CANCEL_NOT_ELIGIBLE" || code === "RECHARGE_NOT_REFUNDABLE") {
      return fail("CONFLICT", "이미 일부 사용되었거나 7일이 경과한 충전 건은 환불 신청을 이용해 주세요.");
    }
    if (code === "INSUFFICIENT_POINTS") {
      return fail("CONFLICT", "현재 보유 포인트가 부족하여 즉시 취소할 수 없습니다.");
    }
    return fail("INTERNAL_ERROR", "충전 취소 처리 중 오류가 발생했습니다.");
  }
}

const rechargeRefundRequestSchema = z.object({
  rechargeId: z.coerce.number().int().positive(),
  reason: z.string().trim().min(2, "환불 사유를 2자 이상 입력해 주세요.").max(300),
});

/** 9. 포인트 충전 부분 사용 / 7일 경과 잔여분 환불 신청 (관리자 승인 대기) */
export async function requestRechargeRefundAction(
  input: z.infer<typeof rechargeRefundRequestSchema>,
): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = rechargeRefundRequestSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "환불 사유를 입력해 주세요.");
  }

  const db = getDb();
  const [recharge] = await db
    .select()
    .from(pointRecharges)
    .where(
      and(
        eq(pointRecharges.id, parsed.data.rechargeId),
        eq(pointRecharges.userId, session.userId),
        eq(pointRecharges.isDeleted, false),
      ),
    )
    .limit(1);

  if (!recharge) return fail("NOT_FOUND", "충전 내역을 찾을 수 없습니다.");
  if (recharge.status !== "PAID") return fail("CONFLICT", "환불 신청 가능한 상태가 아닙니다.");
  if (recharge.channel !== "WEB_PG") {
    return fail("CONFLICT", "인앱결제(Apple/Google)는 각 스토어 고객센터를 통해 환불해 주세요.");
  }

  const [originLedger] = await db
    .select({ remainingAmount: pointLedgers.remainingAmount })
    .from(pointLedgers)
    .where(
      and(
        eq(pointLedgers.userId, session.userId),
        eq(pointLedgers.reason, "EARN_RECHARGE"),
        eq(pointLedgers.refType, "recharge"),
        eq(pointLedgers.refId, recharge.id),
      ),
    )
    .limit(1);

  if ((originLedger?.remainingAmount ?? 0) <= 0) {
    return fail("CONFLICT", "전액 사용 완료된 충전 건은 환불 신청할 수 없습니다.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(pointRecharges)
      .set({
        status: "REFUND_REQUESTED",
        refundReason: parsed.data.reason,
        adminRejectReason: null,
        updatedBy: session.userId,
      })
      .where(and(eq(pointRecharges.id, recharge.id), eq(pointRecharges.status, "PAID")));

    await tx.insert(notifications).values({
      userId: session.userId,
      kind: "NOTICE",
      title: "포인트 충전 환불 신청 접수",
      body: "운영팀이 잔여 충전 포인트를 확인한 뒤 환불 승인 결과를 알려드립니다.",
      deepLink: "/app/wallet",
    });
  });

  revalidatePath("/app/wallet");
  revalidatePath("/admin/recharges");
  return ok({ ok: true });
}

/** 10. 포인트 충전 환불 신청 철회 */
export async function withdrawRechargeRefundAction(
  rechargeId: number,
): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const db = getDb();
  const [updated] = await db
    .update(pointRecharges)
    .set({
      status: "PAID",
      refundReason: null,
      updatedBy: session.userId,
    })
    .where(
      and(
        eq(pointRecharges.id, rechargeId),
        eq(pointRecharges.userId, session.userId),
        eq(pointRecharges.status, "REFUND_REQUESTED"),
      ),
    )
    .returning({ id: pointRecharges.id });

  if (!updated) return fail("CONFLICT", "철회할 수 있는 환불 신청 건이 없습니다.");

  revalidatePath("/app/wallet");
  revalidatePath("/admin/recharges");
  return ok({ ok: true });
}

/** 11. 사용자 구매 확정 (DELIVERED 실물 주문 -> CONFIRMED, 확정 후 반품 불가 · 후기 작성 가능) */
export async function confirmMyOrderAction(
  orderId: number,
): Promise<ActionResult<{ orderId: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const db = getDb();
  const [order] = await db
    .select({ id: orders.id, status: orders.status, orderNo: orders.orderNo })
    .from(orders)
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.userId, session.userId),
        eq(orders.isDeleted, false),
      ),
    )
    .limit(1);

  if (!order) return fail("NOT_FOUND", "주문을 찾을 수 없습니다.");
  if (order.status !== "DELIVERED") {
    return fail("CONFLICT", "배송 완료 상태의 주문만 구매 확정할 수 있습니다.");
  }

  const [updated] = await db
    .update(orders)
    .set({
      status: "CONFIRMED",
      confirmedAt: new Date(),
      updatedBy: session.userId,
    })
    .where(and(eq(orders.id, order.id), eq(orders.status, "DELIVERED")))
    .returning({ id: orders.id });

  if (!updated) {
    return fail("CONFLICT", "주문 상태가 변경되어 구매 확정할 수 없습니다.");
  }

  revalidatePath("/app/shop/orders");
  revalidatePath("/app/shop");
  revalidatePath("/admin/orders");
  return ok({ orderId: order.id });
}

const safeReviewImageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (u) => u.startsWith("/api/uploads/") || u.startsWith("/images/"),
    "허용되지 않는 이미지 경로입니다.",
  );

const createProductReviewSchema = z.object({
  orderItemId: z.coerce.number().int().positive(),
  rating: z.coerce.number().int().min(1).max(5),
  content: z.string().trim(),
  imageUrls: z.array(safeReviewImageUrlSchema).max(5).default([]),
});

/** 12. 실물 상품 구매 확정(CONFIRMED) 후기 작성 + 최초 1회 포인트 적립 (단일 ACID TX) */
export async function createProductReviewAction(
  input: z.infer<typeof createProductReviewSchema>,
): Promise<ActionResult<{ reviewId: number; rewardPoint: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = createProductReviewSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "후기 내용을 확인해 주세요.");
  }

  const policy = await getShopReviewPolicy();
  const contentLen = parsed.data.content.length;
  if (contentLen < policy.minLength) {
    return fail(
      "VALIDATION_ERROR",
      `후기 내용은 최소 ${policy.minLength}자 이상 작성해 주세요. (현재 ${contentLen}자)`,
    );
  }
  if (contentLen > policy.maxLength) {
    return fail(
      "VALIDATION_ERROR",
      `후기 내용은 최대 ${policy.maxLength}자 이하로 작성해 주세요. (현재 ${contentLen}자)`,
    );
  }

  const db = getDb();
  let targetProductId = 0;

  try {
    const result = await db.transaction(async (tx) => {
      // 전역 잠금 순서 1: point_wallets 먼저 잠금
      await ensureWalletLocked(tx, session.userId);

      // 주문 품목 + 주문 소유권/상태 잠금 검증
      const itemRows = await tx.execute<{
        order_item_id: string;
        order_id: string;
        product_id: string;
        product_type_snap: string;
        name_snap: string;
        user_id: string;
        order_status: string;
      }>(
        sql`SELECT oi.id AS order_item_id,
                   oi.order_id,
                   oi.product_id,
                   oi.product_type_snap,
                   oi.name_snap,
                   o.user_id,
                   o.status AS order_status
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            WHERE oi.id = ${parsed.data.orderItemId}
              AND oi.is_deleted = false
              AND o.is_deleted = false
            FOR UPDATE OF oi`,
      );

      const row = itemRows.rows[0];
      if (!row || Number(row.user_id) !== session.userId) {
        throw new Error("ORDER_ITEM_NOT_FOUND");
      }
      if (row.product_type_snap !== "PHYSICAL") {
        throw new Error("NOT_PHYSICAL_PRODUCT");
      }
      if (row.order_status !== "CONFIRMED") {
        throw new Error("ORDER_NOT_CONFIRMED");
      }

      const orderId = Number(row.order_id);
      const productId = Number(row.product_id);
      targetProductId = productId;

      const [existing] = await tx
        .select({ id: productReviews.id })
        .from(productReviews)
        .where(
          and(
            eq(productReviews.orderItemId, parsed.data.orderItemId),
            eq(productReviews.isDeleted, false),
          ),
        )
        .limit(1);
      if (existing) {
        throw new Error("REVIEW_ALREADY_EXISTS");
      }

      const uniqueImages = Array.from(new Set(parsed.data.imageUrls)).slice(0, 5);
      const rewardPoint =
        uniqueImages.length > 0 ? policy.photoRewardPoint : policy.textRewardPoint;

      const [created] = await tx
        .insert(productReviews)
        .values({
          productId,
          orderId,
          orderItemId: parsed.data.orderItemId,
          userId: session.userId,
          rating: parsed.data.rating,
          content: parsed.data.content,
          imageUrls: uniqueImages,
          rewardPoint,
          createdBy: session.userId,
        })
        .returning({ id: productReviews.id });

      const reviewId = created!.id;

      if (rewardPoint > 0) {
        await earnPointsTx(tx, {
          userId: session.userId,
          amount: rewardPoint,
          reason: "REVIEW_REWARD",
          idempotencyKey: `review-reward:${reviewId}`,
          refType: "product_review",
          refId: reviewId,
          memo:
            uniqueImages.length > 0
              ? `포토 후기 적립 (${row.name_snap})`
              : `텍스트 후기 적립 (${row.name_snap})`,
          actorId: session.userId,
        });

        await tx.insert(notifications).values({
          userId: session.userId,
          kind: "NOTICE",
          title: `상품 후기 적립 완료 (+${rewardPoint.toLocaleString("ko-KR")}P)`,
          body: `${row.name_snap} 후기 작성 감사 포인트가 지급되었습니다.`,
          deepLink: "/app/wallet",
        });
      }

      return { reviewId, rewardPoint };
    });

    revalidatePath("/app/shop");
    if (targetProductId > 0) {
      revalidatePath(`/app/shop/products/${targetProductId}`);
      revalidatePath(`/admin/products/${targetProductId}`);
    }
    revalidatePath("/app/shop/orders");
    revalidatePath("/app/wallet");
    revalidatePath("/admin/reviews");
    return ok(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    if (code === "ORDER_ITEM_NOT_FOUND") return fail("NOT_FOUND", "구매 이력을 찾을 수 없습니다.");
    if (code === "NOT_PHYSICAL_PRODUCT") {
      return fail("CONFLICT", "배송 상품만 후기를 작성할 수 있습니다.");
    }
    if (code === "ORDER_NOT_CONFIRMED") {
      return fail("CONFLICT", "구매 확정된 주문만 후기를 작성할 수 있습니다.");
    }
    if (code === "REVIEW_ALREADY_EXISTS") {
      return fail("CONFLICT", "이미 해당 구매 품목의 후기를 작성하셨습니다.");
    }
    return fail("INTERNAL_ERROR", "후기 등록 중 오류가 발생했습니다.");
  }
}

const updateProductReviewSchema = z.object({
  reviewId: z.coerce.number().int().positive(),
  rating: z.coerce.number().int().min(1).max(5),
  content: z.string().trim(),
  imageUrls: z.array(safeReviewImageUrlSchema).max(5).default([]),
});

/** 13. 본인 후기 수정 (삭제 불가 · 최초 적립 포인트 변동 없음) */
export async function updateMyProductReviewAction(
  input: z.infer<typeof updateProductReviewSchema>,
): Promise<ActionResult<{ reviewId: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = updateProductReviewSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "후기 내용을 확인해 주세요.");
  }

  const policy = await getShopReviewPolicy();
  const contentLen = parsed.data.content.length;
  if (contentLen < policy.minLength) {
    return fail(
      "VALIDATION_ERROR",
      `후기 내용은 최소 ${policy.minLength}자 이상 작성해 주세요. (현재 ${contentLen}자)`,
    );
  }
  if (contentLen > policy.maxLength) {
    return fail(
      "VALIDATION_ERROR",
      `후기 내용은 최대 ${policy.maxLength}자 이하로 작성해 주세요. (현재 ${contentLen}자)`,
    );
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: productReviews.id, productId: productReviews.productId })
    .from(productReviews)
    .where(
      and(
        eq(productReviews.id, parsed.data.reviewId),
        eq(productReviews.userId, session.userId),
        eq(productReviews.isDeleted, false),
      ),
    )
    .limit(1);

  if (!existing) return fail("NOT_FOUND", "수정할 후기를 찾을 수 없습니다.");

  const uniqueImages = Array.from(new Set(parsed.data.imageUrls)).slice(0, 5);
  await db
    .update(productReviews)
    .set({
      rating: parsed.data.rating,
      content: parsed.data.content,
      imageUrls: uniqueImages,
      updatedBy: session.userId,
    })
    .where(eq(productReviews.id, existing.id));

  revalidatePath("/app/shop");
  revalidatePath(`/app/shop/products/${existing.productId}`);
  revalidatePath("/app/shop/orders");
  revalidatePath("/admin/reviews");
  revalidatePath(`/admin/products/${existing.productId}`);
  return ok({ reviewId: existing.id });
}
