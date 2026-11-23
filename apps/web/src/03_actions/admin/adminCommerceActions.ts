"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  and,
  eq,
  getDb,
  notifications,
  orderItems,
  orders,
  pointLedgers,
  pointRecharges,
  policyConfigHistories,
  policyConfigs,
  productCategories,
  productImages,
  productReviews,
  products,
  productVariants,
  shipments,
  sql,
} from "@repo/db";
import { fail, ok, type ActionResult } from "@repo/types";
import { sanitizeProductDetailHtml } from "@/00_lib/sanitizeHtml";
import { getCurrentAdminSession } from "@/00_lib/session";
import { recordAuditLog } from "@/04_services/shared/auditService";
import {
  computeRechargeRefundMeta,
  restoreOrderStockTx,
} from "@/04_services/shared/commerceRefundService";
import {
  earnPointsTx,
  ensureWalletLocked,
  revokeRechargeLedgerTx,
} from "@/04_services/shared/pointLedgerService";

const categorySchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  code: z.string().min(2).max(60),
  name: z.string().min(1).max(80),
  sortOrder: z.coerce.number().int().default(0),
});

export async function adminUpsertCategoryAction(
  input: z.infer<typeof categorySchema>,
): Promise<ActionResult<{ id: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", "카테고리 정보를 확인해 주세요.");

  const db = getDb();
  if (parsed.data.id) {
    await db
      .update(productCategories)
      .set({
        code: parsed.data.code.trim().toUpperCase(),
        name: parsed.data.name.trim(),
        sortOrder: parsed.data.sortOrder,
        updatedBy: session.adminId,
      })
      .where(eq(productCategories.id, parsed.data.id));
    revalidatePath("/admin/products/categories");
    return ok({ id: parsed.data.id });
  }

  const [created] = await db
    .insert(productCategories)
    .values({
      code: parsed.data.code.trim().toUpperCase(),
      name: parsed.data.name.trim(),
      sortOrder: parsed.data.sortOrder,
      createdBy: session.adminId,
    })
    .returning();

  await recordAuditLog({
    actorId: session.adminId,
    action: "product_category.create",
    entity: "product_categories",
    entityId: created!.id,
    afterData: parsed.data,
  });

  revalidatePath("/admin/products/categories");
  return ok({ id: created!.id });
}

export async function adminSoftDeleteCategoryAction(
  categoryId: number,
): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  const [used] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.categoryId, categoryId), eq(products.isDeleted, false)))
    .limit(1);

  if (used) {
    return fail(
      "REFERENCE_BLOCKED",
      "이 카테고리에 등록된 상품이 존재하여 삭제할 수 없습니다. 상품의 카테고리를 먼저 변경하세요.",
    );
  }

  await db
    .update(productCategories)
    .set({ isDeleted: true, deletedAt: new Date(), deletedBy: session.adminId })
    .where(eq(productCategories.id, categoryId));

  await recordAuditLog({
    actorId: session.adminId,
    action: "entity.soft_delete",
    entity: "product_categories",
    entityId: categoryId,
    afterData: { isDeleted: true },
  });

  revalidatePath("/admin/products/categories");
  revalidatePath("/admin/audit-logs");
  return ok({ ok: true });
}

const safeProductImageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (u) => u.startsWith("/api/uploads/") || u.startsWith("/images/") || u.startsWith("https://"),
    "허용되지 않는 상품 이미지 경로입니다.",
  );

const productVariantInputSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1).max(100),
  addPoint: z.coerce.number().int().min(0).default(0),
  stock: z.coerce.number().int().min(0).default(0),
});

const productSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive(),
  type: z.enum(["PHYSICAL", "INQUIRY_TICKET", "PREMIUM_UNLOCK"]),
  name: z.string().min(2).max(150),
  description: z.string().max(1500).optional(),
  detailHtml: z.string().max(50000).optional(),
  imageUrls: z.array(safeProductImageUrlSchema).max(10).optional(),
  variants: z.array(productVariantInputSchema).max(30).optional(),
  pointPrice: z.coerce.number().int().min(0),
  stock: z.coerce.number().int().min(0),
  status: z.enum(["ACTIVE", "INACTIVE", "SOLD_OUT"]),
  linkedCourseId: z.coerce.number().int().positive().nullable().optional(),
  isFeatured: z.boolean().default(false),
});

export async function adminUpsertProductAction(
  input: z.infer<typeof productSchema>,
): Promise<ActionResult<{ id: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "상품 정보를 확인해 주세요.");
  }

  const db = getDb();
  const data = parsed.data;
  const cleanDetailHtml = sanitizeProductDetailHtml(data.detailHtml);
  const nextImageUrls = data.imageUrls ? Array.from(new Set(data.imageUrls)).slice(0, 10) : undefined;

  if (data.id) {
    const targetId = data.id;
    await db.transaction(async (tx) => {
      await tx
        .update(products)
        .set({
          categoryId: data.categoryId,
          type: data.type,
          name: data.name.trim(),
          description: data.description?.trim() || null,
          detailHtml: cleanDetailHtml,
          pointPrice: data.pointPrice,
          stock: data.stock,
          status: data.status,
          linkedCourseId: data.linkedCourseId ?? null,
          isFeatured: data.isFeatured,
          updatedBy: session.adminId,
        })
        .where(eq(products.id, targetId));

      if (nextImageUrls !== undefined) {
        // 기존 이미지 행 소프트 삭제 후 최신 순서대로 재등록 (디스크 파일은 복원 대비 보존)
        await tx
          .update(productImages)
          .set({ isDeleted: true, deletedAt: new Date(), deletedBy: session.adminId })
          .where(and(eq(productImages.productId, targetId), eq(productImages.isDeleted, false)));

        for (let idx = 0; idx < nextImageUrls.length; idx++) {
          await tx.insert(productImages).values({
            productId: targetId,
            url: nextImageUrls[idx]!,
            sortOrder: idx,
            createdBy: session.adminId,
          });
        }
      }

      if (data.variants !== undefined) {
        const existingVars = await tx
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(and(eq(productVariants.productId, targetId), eq(productVariants.isDeleted, false)));
        const existingIds = new Set(existingVars.map((v) => v.id));
        const keptIds = new Set<number>();

        for (const v of data.variants) {
          if (v.id && existingIds.has(v.id)) {
            keptIds.add(v.id);
            await tx
              .update(productVariants)
              .set({
                name: v.name,
                addPoint: v.addPoint,
                stock: v.stock,
                updatedBy: session.adminId,
              })
              .where(eq(productVariants.id, v.id));
          } else {
            await tx.insert(productVariants).values({
              productId: targetId,
              name: v.name,
              addPoint: v.addPoint,
              stock: v.stock,
              createdBy: session.adminId,
            });
          }
        }

        // 제거된 기존 옵션은 FK 보존을 위해 소프트 삭제
        for (const oldId of existingIds) {
          if (!keptIds.has(oldId)) {
            await tx
              .update(productVariants)
              .set({ isDeleted: true, deletedAt: new Date(), deletedBy: session.adminId })
              .where(eq(productVariants.id, oldId));
          }
        }
      }
    });

    await recordAuditLog({
      actorId: session.adminId,
      action: "product.update",
      entity: "products",
      entityId: targetId,
      afterData: {
        ...data,
        detailHtml: cleanDetailHtml ? `(HTML ${cleanDetailHtml.length} chars)` : null,
        imageCount: nextImageUrls?.length,
      },
    });

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${targetId}`);
    revalidatePath("/app/shop");
    revalidatePath(`/app/shop/products/${targetId}`);
    return ok({ id: targetId });
  }

  const createdId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(products)
      .values({
        categoryId: data.categoryId,
        type: data.type,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        detailHtml: cleanDetailHtml,
        pointPrice: data.pointPrice,
        stock: data.stock,
        status: data.status,
        linkedCourseId: data.linkedCourseId ?? null,
        isFeatured: data.isFeatured,
        createdBy: session.adminId,
      })
      .returning();

    const pid = created!.id;
    if (nextImageUrls && nextImageUrls.length > 0) {
      for (let idx = 0; idx < nextImageUrls.length; idx++) {
        await tx.insert(productImages).values({
          productId: pid,
          url: nextImageUrls[idx]!,
          sortOrder: idx,
          createdBy: session.adminId,
        });
      }
    }
    if (data.variants && data.variants.length > 0) {
      for (const v of data.variants) {
        await tx.insert(productVariants).values({
          productId: pid,
          name: v.name,
          addPoint: v.addPoint,
          stock: v.stock,
          createdBy: session.adminId,
        });
      }
    }
    return pid;
  });

  await recordAuditLog({
    actorId: session.adminId,
    action: "product.create",
    entity: "products",
    entityId: createdId,
    afterData: {
      ...data,
      detailHtml: cleanDetailHtml ? `(HTML ${cleanDetailHtml.length} chars)` : null,
      imageCount: nextImageUrls?.length ?? 0,
    },
  });

  revalidatePath("/admin/products");
  revalidatePath("/app/shop");
  return ok({ id: createdId });
}

export async function adminSoftDeleteProductAction(productId: number): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  const [ordered] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(and(eq(orderItems.productId, productId), eq(orderItems.isDeleted, false)))
    .limit(1);

  if (ordered) {
    return fail("REFERENCE_BLOCKED", "주문 이력이 존재하는 상품은 삭제할 수 없습니다. 판매 중지(INACTIVE)로 변경하세요.");
  }

  await db
    .update(products)
    .set({ isDeleted: true, deletedAt: new Date(), deletedBy: session.adminId })
    .where(eq(products.id, productId));

  await recordAuditLog({
    actorId: session.adminId,
    action: "entity.soft_delete",
    entity: "products",
    entityId: productId,
    afterData: { isDeleted: true },
  });

  revalidatePath("/admin/products");
  revalidatePath("/admin/audit-logs");
  return ok({ ok: true });
}

export async function adminUpdateOrderShipmentAction(input: {
  orderId: number;
  status: "PREPARING" | "SHIPPING" | "DELIVERED";
  courier?: string;
  trackingNo?: string;
}): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!order) return fail("NOT_FOUND", "주문을 찾을 수 없습니다.");

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: input.status, updatedBy: session.adminId })
      .where(eq(orders.id, order.id));

    const [ship] = await tx
      .select()
      .from(shipments)
      .where(and(eq(shipments.orderId, order.id), eq(shipments.isDeleted, false)))
      .limit(1);

    const shipStatus =
      input.status === "DELIVERED" ? "DELIVERED" : input.status === "SHIPPING" ? "SHIPPING" : "READY";

    if (ship) {
      await tx
        .update(shipments)
        .set({
          courier: input.courier?.trim() || ship.courier,
          trackingNo: input.trackingNo?.trim() || ship.trackingNo,
          status: shipStatus,
          shippedAt: input.status === "SHIPPING" ? new Date() : ship.shippedAt,
          deliveredAt: input.status === "DELIVERED" ? new Date() : ship.deliveredAt,
          updatedBy: session.adminId,
        })
        .where(eq(shipments.id, ship.id));
    } else {
      await tx.insert(shipments).values({
        orderId: order.id,
        courier: input.courier?.trim() || null,
        trackingNo: input.trackingNo?.trim() || null,
        status: shipStatus,
        createdBy: session.adminId,
      });
    }

    await tx.insert(notifications).values({
      userId: order.userId,
      kind: "ORDER_UPDATE",
      title: `주문(${order.orderNo}) 상태 변경: ${input.status}`,
      body: input.trackingNo ? `송장번호: ${input.courier ?? ""} ${input.trackingNo}` : "주문 배송 상태를 확인해 주세요.",
      deepLink: "/app/shop/orders",
    });
  });

  await recordAuditLog({
    actorId: session.adminId,
    action: "order.shipment_update",
    entity: "orders",
    entityId: order.id,
    afterData: input,
  });

  revalidatePath("/admin/orders");
  return ok({ ok: true });
}

export async function adminCancelOrderRefundAction(
  orderId: number,
  options?: { restoreStock?: boolean },
): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const restoreStock = options?.restoreStock ?? true;
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return fail("NOT_FOUND", "주문을 찾을 수 없습니다.");
  if (order.status === "CANCELLED" || order.status === "REFUNDED") {
    return fail("CONFLICT", "이미 취소/환불된 주문입니다.");
  }

  try {
    await db.transaction(async (tx) => {
      // 전역 잠금 순서 1: point_wallets 먼저 잠금
      await ensureWalletLocked(tx, order.userId);

      // 전역 잠금 순서 2: orders 행 FOR UPDATE 후 최신 상태 재검증
      const lockedOrderRows = await tx.execute<{ id: string; status: string }>(
        sql`SELECT id, status FROM orders WHERE id = ${order.id} FOR UPDATE`,
      );
      const liveStatus = lockedOrderRows.rows[0]?.status;
      if (!liveStatus || liveStatus === "CANCELLED" || liveStatus === "REFUNDED") {
        throw new Error("ORDER_CONFLICT");
      }

      const [updated] = await tx
        .update(orders)
        .set({
          status: "REFUNDED",
          adminRejectReason: null,
          cancelledAt: order.cancelledAt ?? new Date(),
          refundedAt: new Date(),
          updatedBy: session.adminId,
        })
        .where(and(eq(orders.id, order.id), eq(orders.status, liveStatus as typeof order.status)))
        .returning({ id: orders.id });

      if (!updated) throw new Error("ORDER_CONFLICT");

      if (restoreStock) {
        await restoreOrderStockTx(tx, order.id, session.adminId);
      }

      if (liveStatus === "RETURN_REQUESTED") {
        await tx
          .update(shipments)
          .set({ status: "RETURNED", updatedBy: session.adminId })
          .where(and(eq(shipments.orderId, order.id), eq(shipments.isDeleted, false)));
      }

      if (order.paidPoints > 0) {
        await earnPointsTx(tx, {
          userId: order.userId,
          amount: order.paidPoints,
          reason: "REFUND",
          idempotencyKey: `order-refund:${order.id}`,
          refType: "order",
          refId: order.id,
          memo: `관리자 주문(${order.orderNo}) 취소·환불 승인`,
          actorId: session.adminId,
        });
      }

      await tx.insert(notifications).values({
        userId: order.userId,
        kind: "ORDER_UPDATE",
        title: `주문 환불 완료 (${order.orderNo})`,
        body: `${order.paidPoints.toLocaleString("ko-KR")}P가 포인트 지갑으로 전액 환불되었습니다.`,
        deepLink: "/app/shop/orders",
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_CONFLICT") {
      return fail("CONFLICT", "이미 취소/환불되었거나 상태가 변경된 주문입니다.");
    }
    return fail("INTERNAL_ERROR", "주문 환불 처리 중 오류가 발생했습니다.");
  }

  await recordAuditLog({
    actorId: session.adminId,
    action: "order.admin_refund",
    entity: "orders",
    entityId: order.id,
    afterData: { prevStatus: order.status, refundedPoints: order.paidPoints, restoreStock },
  });

  revalidatePath("/admin/orders");
  revalidatePath("/app/shop/orders");
  revalidatePath("/app/wallet");
  return ok({ ok: true });
}

export async function adminRejectOrderRequestAction(input: {
  orderId: number;
  rejectReason: string;
}): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const reason = input.rejectReason.trim();
  if (reason.length < 2) return fail("VALIDATION_ERROR", "반려 사유를 2자 이상 입력해 주세요.");

  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!order) return fail("NOT_FOUND", "주문을 찾을 수 없습니다.");
  if (order.status !== "CANCEL_REQUESTED" && order.status !== "RETURN_REQUESTED") {
    return fail("CONFLICT", "취소 또는 반품 요청 상태의 주문만 반려할 수 있습니다.");
  }

  let revertStatus: "PREPARING" | "SHIPPING" | "DELIVERED" = "DELIVERED";
  if (order.status === "CANCEL_REQUESTED") {
    const [ship] = await db
      .select({ trackingNo: shipments.trackingNo, status: shipments.status })
      .from(shipments)
      .where(and(eq(shipments.orderId, order.id), eq(shipments.isDeleted, false)))
      .limit(1);
    revertStatus = ship?.trackingNo || ship?.status === "SHIPPING" ? "SHIPPING" : "PREPARING";
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: revertStatus,
        adminRejectReason: reason,
        updatedBy: session.adminId,
      })
      .where(and(eq(orders.id, order.id), eq(orders.status, order.status)));

    await tx.insert(notifications).values({
      userId: order.userId,
      kind: "ORDER_UPDATE",
      title:
        order.status === "CANCEL_REQUESTED"
          ? `주문 취소 요청 반려 (${order.orderNo})`
          : `반품 · 환불 요청 반려 (${order.orderNo})`,
      body: `반려 사유: ${reason}`,
      deepLink: "/app/shop/orders",
    });
  });

  await recordAuditLog({
    actorId: session.adminId,
    action: "order.request_reject",
    entity: "orders",
    entityId: order.id,
    afterData: { prevStatus: order.status, revertStatus, rejectReason: reason },
  });

  revalidatePath("/admin/orders");
  revalidatePath("/app/shop/orders");
  return ok({ ok: true });
}

/** 관리자 포인트 충전 환불 승인 (PAID 또는 REFUND_REQUESTED — GM-103 잔여 충전분 비례 환불) */
export async function adminApproveRechargeRefundAction(
  rechargeId: number,
): Promise<ActionResult<{ refundedPoints: number; refundedCash: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  try {
    const [ownerRow] = await db
      .select({ userId: pointRecharges.userId })
      .from(pointRecharges)
      .where(and(eq(pointRecharges.id, rechargeId), eq(pointRecharges.isDeleted, false)))
      .limit(1);
    if (!ownerRow) return fail("NOT_FOUND", "충전 내역을 찾을 수 없습니다.");

    const result = await db.transaction(async (tx) => {
      // 전역 잠금 순서 1: point_wallets 먼저 잠금
      const lockedWallet = await ensureWalletLocked(tx, ownerRow.userId);

      // 전역 잠금 순서 2: point_recharges 행 FOR UPDATE 잠금
      const rechargeRows = await tx.execute<{
        id: string;
        user_id: string;
        channel: "WEB_PG" | "IOS_IAP" | "ANDROID_IAP";
        point_amount: string;
        paid_amount: string;
        status: string;
        paid_at: string | Date | null;
        refund_reason: string | null;
      }>(
        sql`SELECT id, user_id, channel, point_amount, paid_amount, status, paid_at, refund_reason
            FROM point_recharges
            WHERE id = ${rechargeId} AND is_deleted = false
            FOR UPDATE`,
      );
      const rawRec = rechargeRows.rows[0];
      if (!rawRec) throw new Error("RECHARGE_NOT_FOUND");
      const recharge = {
        id: Number(rawRec.id),
        userId: Number(rawRec.user_id),
        channel: rawRec.channel,
        pointAmount: Number(rawRec.point_amount),
        paidAmount: Number(rawRec.paid_amount),
        status: rawRec.status,
        paidAt: rawRec.paid_at ? new Date(rawRec.paid_at) : null,
        refundReason: rawRec.refund_reason,
      };
      if (recharge.status !== "PAID" && recharge.status !== "REFUND_REQUESTED") {
        throw new Error("RECHARGE_INVALID_STATUS");
      }

      const originRows = await tx.execute<{ remaining_amount: string }>(
        sql`SELECT remaining_amount
            FROM point_ledgers
            WHERE user_id = ${recharge.userId}
              AND reason = 'EARN_RECHARGE'
              AND ref_type = 'recharge'
              AND ref_id = ${recharge.id}
            ORDER BY id ASC
            LIMIT 1
            FOR UPDATE`,
      );

      const meta = computeRechargeRefundMeta({
        status: "PAID",
        channel: recharge.channel,
        pointAmount: recharge.pointAmount,
        paidAmount: recharge.paidAmount,
        paidAt: recharge.paidAt,
        remainingAmount: Number(originRows.rows[0]?.remaining_amount ?? 0),
        walletBalance: lockedWallet.balance,
      });

      if (meta.refundablePoints <= 0) {
        throw new Error("NO_REFUNDABLE_POINTS");
      }

      await revokeRechargeLedgerTx(tx, {
        userId: recharge.userId,
        rechargeId: recharge.id,
        amount: meta.refundablePoints,
        idempotencyKey: `recharge-refund:${recharge.id}`,
        memo: `관리자 충전 환불 승인 (#${recharge.id}, ${meta.refundableCash.toLocaleString("ko-KR")}원)`,
        actorId: session.adminId,
      });

      const [updated] = await tx
        .update(pointRecharges)
        .set({
          status: "REFUNDED",
          refundedAt: new Date(),
          refundReason: recharge.refundReason ?? "관리자 수동 환불 처리",
          refundedPointAmount: meta.refundablePoints,
          refundedCashAmount: meta.refundableCash,
          adminRejectReason: null,
          updatedBy: session.adminId,
        })
        .where(
          and(
            eq(pointRecharges.id, recharge.id),
            eq(pointRecharges.status, recharge.status as "PAID" | "REFUND_REQUESTED"),
          ),
        )
        .returning({ id: pointRecharges.id });

      if (!updated) throw new Error("RECHARGE_INVALID_STATUS");

      await tx.insert(notifications).values({
        userId: recharge.userId,
        kind: "NOTICE",
        title: `포인트 충전 환불 완료 (${meta.refundableCash.toLocaleString("ko-KR")}원)`,
        body: `잔여 충전 ${meta.refundablePoints.toLocaleString("ko-KR")}P 회수 및 결제 환불이 승인되었습니다.`,
        deepLink: "/app/wallet",
      });

      return {
        userId: recharge.userId,
        refundedPoints: meta.refundablePoints,
        refundedCash: meta.refundableCash,
      };
    });

    await recordAuditLog({
      actorId: session.adminId,
      action: "recharge.refund_approve",
      entity: "point_recharges",
      entityId: rechargeId,
      afterData: {
        userId: result.userId,
        refundedPoints: result.refundedPoints,
        refundedCash: result.refundedCash,
      },
    });

    revalidatePath("/admin/recharges");
    revalidatePath(`/admin/users/${result.userId}`);
    revalidatePath("/app/wallet");
    return ok({ refundedPoints: result.refundedPoints, refundedCash: result.refundedCash });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    if (code === "RECHARGE_NOT_FOUND") return fail("NOT_FOUND", "충전 내역을 찾을 수 없습니다.");
    if (code === "RECHARGE_INVALID_STATUS") {
      return fail("CONFLICT", "이미 환불되었거나 환불 승인할 수 없는 상태입니다.");
    }
    if (code === "NO_REFUNDABLE_POINTS" || code === "RECHARGE_NOT_REFUNDABLE") {
      return fail("CONFLICT", "환불 가능한 잔여 충전 포인트가 없습니다.");
    }
    if (code === "INSUFFICIENT_POINTS") {
      return fail("CONFLICT", "회원의 현재 지갑 잔액이 환불 대상 포인트보다 부족합니다.");
    }
    return fail("INTERNAL_ERROR", "충전 환불 승인 중 오류가 발생했습니다.");
  }
}

/** 관리자 포인트 충전 환불 신청 반려 */
export async function adminRejectRechargeRefundAction(input: {
  rechargeId: number;
  rejectReason: string;
}): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const reason = input.rejectReason.trim();
  if (reason.length < 2) return fail("VALIDATION_ERROR", "반려 사유를 2자 이상 입력해 주세요.");

  const db = getDb();
  const [recharge] = await db
    .select()
    .from(pointRecharges)
    .where(and(eq(pointRecharges.id, input.rechargeId), eq(pointRecharges.isDeleted, false)))
    .limit(1);

  if (!recharge) return fail("NOT_FOUND", "충전 내역을 찾을 수 없습니다.");
  if (recharge.status !== "REFUND_REQUESTED") {
    return fail("CONFLICT", "환불 신청 상태의 건만 반려할 수 있습니다.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(pointRecharges)
      .set({
        status: "PAID",
        adminRejectReason: reason,
        updatedBy: session.adminId,
      })
      .where(and(eq(pointRecharges.id, recharge.id), eq(pointRecharges.status, "REFUND_REQUESTED")));

    await tx.insert(notifications).values({
      userId: recharge.userId,
      kind: "NOTICE",
      title: "포인트 충전 환불 신청 반려",
      body: `반려 사유: ${reason}`,
      deepLink: "/app/wallet",
    });
  });

  await recordAuditLog({
    actorId: session.adminId,
    action: "recharge.refund_reject",
    entity: "point_recharges",
    entityId: recharge.id,
    afterData: { userId: recharge.userId, rejectReason: reason },
  });

  revalidatePath("/admin/recharges");
  revalidatePath(`/admin/users/${recharge.userId}`);
  revalidatePath("/app/wallet");
  return ok({ ok: true });
}

/** 관리자 상품 후기 숨김(블라인드) 토글 */
export async function adminToggleReviewHiddenAction(input: {
  reviewId: number;
  isHidden: boolean;
}): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  const [review] = await db
    .select({ id: productReviews.id, productId: productReviews.productId })
    .from(productReviews)
    .where(and(eq(productReviews.id, input.reviewId), eq(productReviews.isDeleted, false)))
    .limit(1);
  if (!review) return fail("NOT_FOUND", "후기를 찾을 수 없습니다.");

  await db
    .update(productReviews)
    .set({ isHidden: input.isHidden, updatedBy: session.adminId })
    .where(eq(productReviews.id, review.id));

  await recordAuditLog({
    actorId: session.adminId,
    action: input.isHidden ? "product_review.hide" : "product_review.unhide",
    entity: "product_reviews",
    entityId: review.id,
    afterData: { isHidden: input.isHidden },
  });

  revalidatePath("/admin/reviews");
  revalidatePath(`/admin/products/${review.productId}`);
  revalidatePath("/app/shop");
  revalidatePath(`/app/shop/products/${review.productId}`);
  return ok({ ok: true });
}

/** 관리자 상품 후기 공식 답글 저장/삭제 */
export async function adminReplyProductReviewAction(input: {
  reviewId: number;
  adminReply: string;
}): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const replyText = input.adminReply.trim();
  if (replyText.length > 1000) {
    return fail("VALIDATION_ERROR", "관리자 답글은 1,000자 이하로 입력해 주세요.");
  }

  const db = getDb();
  const [review] = await db
    .select({
      id: productReviews.id,
      productId: productReviews.productId,
      userId: productReviews.userId,
      adminReply: productReviews.adminReply,
    })
    .from(productReviews)
    .where(and(eq(productReviews.id, input.reviewId), eq(productReviews.isDeleted, false)))
    .limit(1);
  if (!review) return fail("NOT_FOUND", "후기를 찾을 수 없습니다.");

  await db.transaction(async (tx) => {
    await tx
      .update(productReviews)
      .set({
        adminReply: replyText || null,
        adminRepliedAt: replyText ? new Date() : null,
        updatedBy: session.adminId,
      })
      .where(eq(productReviews.id, review.id));

    if (replyText && !review.adminReply) {
      await tx.insert(notifications).values({
        userId: review.userId,
        kind: "NOTICE",
        title: "작성하신 상품 후기에 공식 답글이 등록되었어요",
        body: replyText.slice(0, 80),
        deepLink: `/app/shop/products/${review.productId}`,
      });
    }
  });

  await recordAuditLog({
    actorId: session.adminId,
    action: "product_review.reply",
    entity: "product_reviews",
    entityId: review.id,
    afterData: { adminReply: replyText || null },
  });

  revalidatePath("/admin/reviews");
  revalidatePath(`/admin/products/${review.productId}`);
  revalidatePath(`/app/shop/products/${review.productId}`);
  return ok({ ok: true });
}

const reviewPolicyUpdateSchema = z.object({
  textRewardPoint: z.coerce.number().int().min(0).max(100000),
  photoRewardPoint: z.coerce.number().int().min(0).max(100000),
  minLength: z.coerce.number().int().min(5).max(500),
  maxLength: z.coerce.number().int().min(50).max(3000),
});

/** 관리자 후기 적립 포인트·글자수 정책 일괄 수정 (/admin/reviews 빠른 설정 바) */
export async function adminUpdateShopReviewPoliciesAction(
  input: z.infer<typeof reviewPolicyUpdateSchema>,
): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const parsed = reviewPolicyUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "정책 수치를 확인해 주세요.");
  }
  if (parsed.data.minLength >= parsed.data.maxLength) {
    return fail("VALIDATION_ERROR", "최소 글자수는 최대 글자수보다 작아야 합니다.");
  }

  const updates: Array<{ key: string; value: number }> = [
    { key: "shop.review.text_reward_point", value: parsed.data.textRewardPoint },
    { key: "shop.review.photo_reward_point", value: parsed.data.photoRewardPoint },
    { key: "shop.review.min_length", value: parsed.data.minLength },
    { key: "shop.review.max_length", value: parsed.data.maxLength },
  ];

  const db = getDb();
  await db.transaction(async (tx) => {
    for (const item of updates) {
      const [existing] = await tx
        .select()
        .from(policyConfigs)
        .where(and(eq(policyConfigs.key, item.key), eq(policyConfigs.isDeleted, false)))
        .limit(1);
      if (!existing) continue;
      if (existing.value === item.value) continue;

      await tx
        .update(policyConfigs)
        .set({ value: item.value, updatedBy: session.adminId })
        .where(eq(policyConfigs.id, existing.id));

      await tx.insert(policyConfigHistories).values({
        policyConfigId: existing.id,
        key: existing.key,
        oldValue: existing.value,
        newValue: item.value,
        adminId: session.adminId,
      });
    }
  });

  await recordAuditLog({
    actorId: session.adminId,
    action: "policy.review_batch_update",
    entity: "policy_configs",
    entityId: 0,
    afterData: parsed.data,
  });

  revalidatePath("/admin/reviews");
  revalidatePath("/admin/policies");
  revalidatePath("/app/shop");
  revalidatePath("/app/shop/orders");
  return ok({ ok: true });
}
