"use server";

import { revalidatePath } from "next/cache";
import {
  and,
  banners,
  eq,
  getDb,
  inquiries,
  notifications,
  notificationTemplates,
  policyConfigHistories,
  policyConfigs,
  trainers,
  trainerSettlements,
  users,
} from "@repo/db";
import { fail, ok, type ActionResult } from "@repo/types";
import { sendPushAdapter } from "@/00_lib/adapters";
import { getCurrentAdminSession } from "@/00_lib/session";
import { recordAuditLog, restoreSoftDeletedEntity } from "@/04_services/shared/auditService";
import { getPolicyNumber } from "@/04_services/shared/policyService";

export async function adminAssignInquiryAction(input: {
  inquiryId: number;
  trainerId: number;
}): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  await db
    .update(inquiries)
    .set({
      trainerId: input.trainerId,
      status: "ASSIGNED",
      assignedAt: new Date(),
      updatedBy: session.adminId,
    })
    .where(eq(inquiries.id, input.inquiryId));

  await recordAuditLog({
    actorId: session.adminId,
    action: "inquiry.assign",
    entity: "inquiries",
    entityId: input.inquiryId,
    afterData: input,
  });

  revalidatePath("/admin/inquiries");
  revalidatePath("/admin/trainer");
  return ok({ ok: true });
}

export async function trainerSubmitAnswerAction(input: {
  inquiryId: number;
  answerText: string;
  answerVideoUrl?: string;
}): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");
  if (input.answerText.trim().length < 5) {
    return fail("VALIDATION_ERROR", "답변 내용을 5자 이상 입력해 주세요.");
  }

  const db = getDb();
  const [inq] = await db
    .select()
    .from(inquiries)
    .where(and(eq(inquiries.id, input.inquiryId), eq(inquiries.isDeleted, false)))
    .limit(1);
  if (!inq) return fail("NOT_FOUND", "문의를 찾을 수 없습니다.");

  // TRAINER는 본인에게 배정된 문의만 답변 가능 (IDOR 방어)
  if (session.role === "TRAINER") {
    const [myTrainer] = await db
      .select()
      .from(trainers)
      .where(and(eq(trainers.adminId, session.adminId), eq(trainers.isDeleted, false)))
      .limit(1);
    if (!myTrainer || inq.trainerId !== myTrainer.id) {
      return fail("FORBIDDEN", "본인에게 배정된 문의만 답변할 수 있습니다.");
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(inquiries)
      .set({
        answerText: input.answerText.trim(),
        answerVideoUrl: input.answerVideoUrl?.trim() || null,
        answeredAt: new Date(),
        status: "ANSWERED",
        updatedBy: session.adminId,
      })
      .where(eq(inquiries.id, inq.id));

    await tx.insert(notifications).values({
      userId: inq.userId,
      kind: "INQUIRY_ANSWERED",
      title: "훈련사님의 영상 Q&A 답변이 도착했어요",
      body: "지금 답변 내용을 확인해 보세요.",
      deepLink: `/app/inquiry/${inq.id}`,
      createdBy: session.adminId,
    });
  });

  await sendPushAdapter({
    userId: inq.userId,
    title: "영상 Q&A 답변 완료",
    body: "훈련사님의 맞춤 답변이 등록되었습니다.",
    deepLink: `/app/inquiry/${inq.id}`,
  });

  await recordAuditLog({
    actorId: session.adminId,
    action: "inquiry.answer",
    entity: "inquiries",
    entityId: inq.id,
  });

  revalidatePath("/admin/trainer");
  revalidatePath(`/admin/trainer/${inq.id}`);
  revalidatePath("/admin/inquiries");
  revalidatePath(`/app/inquiry/${inq.id}`);
  return ok({ ok: true });
}

export async function adminGenerateMonthlySettlementAction(
  periodYm: string,
): Promise<ActionResult<{ count: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");
  if (!/^\d{4}-\d{2}$/.test(periodYm)) {
    return fail("VALIDATION_ERROR", "정산 월 형식(YYYY-MM)을 확인해 주세요.");
  }

  const rate = await getPolicyNumber("settlement.commission_rate");
  const db = getDb();
  const activeTrainers = await db.select().from(trainers).where(eq(trainers.isDeleted, false));
  const answeredInquiries = await db
    .select()
    .from(inquiries)
    .where(and(eq(inquiries.status, "ANSWERED"), eq(inquiries.isDeleted, false)));

  let count = 0;
  for (const tr of activeTrainers) {
    const matched = answeredInquiries.filter((i) => {
      if (i.trainerId !== tr.id || !i.answeredAt) return false;
      const ym = `${i.answeredAt.getFullYear()}-${String(i.answeredAt.getMonth() + 1).padStart(2, "0")}`;
      return ym === periodYm;
    });

    const totalPoints = matched.reduce((sum, i) => sum + i.paidPoints, 0);
    const payoutAmount = Math.floor(totalPoints * rate);

    const [exist] = await db
      .select()
      .from(trainerSettlements)
      .where(
        and(
          eq(trainerSettlements.trainerId, tr.id),
          eq(trainerSettlements.periodYm, periodYm),
          eq(trainerSettlements.isDeleted, false),
        ),
      )
      .limit(1);

    if (exist) {
      if (exist.status === "DRAFT") {
        await db
          .update(trainerSettlements)
          .set({
            totalInquiries: matched.length,
            totalPoints,
            commissionRate: rate.toFixed(4),
            payoutAmount,
            updatedBy: session.adminId,
          })
          .where(eq(trainerSettlements.id, exist.id));
        count += 1;
      }
    } else {
      await db.insert(trainerSettlements).values({
        trainerId: tr.id,
        periodYm,
        totalInquiries: matched.length,
        totalPoints,
        commissionRate: rate.toFixed(4),
        payoutAmount,
        status: "DRAFT",
        createdBy: session.adminId,
      });
      count += 1;
    }
  }

  await recordAuditLog({
    actorId: session.adminId,
    action: "settlement.generate",
    entity: "trainer_settlements",
    afterData: { periodYm, count },
  });

  revalidatePath("/admin/trainers/settlements");
  return ok({ count });
}

export async function adminUpdateSettlementStatusAction(input: {
  id: number;
  status: "CONFIRMED" | "PAID";
}): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  await db
    .update(trainerSettlements)
    .set({
      status: input.status,
      confirmedAt: input.status === "CONFIRMED" ? new Date() : undefined,
      paidAt: input.status === "PAID" ? new Date() : undefined,
      updatedBy: session.adminId,
    })
    .where(eq(trainerSettlements.id, input.id));

  await recordAuditLog({
    actorId: session.adminId,
    action: "settlement.status_update",
    entity: "trainer_settlements",
    entityId: input.id,
    afterData: input,
  });

  revalidatePath("/admin/trainers/settlements");
  return ok({ ok: true });
}

export async function adminCreateTrainerAction(input: {
  name: string;
  bio?: string;
  careerYears?: number;
}): Promise<ActionResult<{ id: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  const [created] = await db
    .insert(trainers)
    .values({
      name: input.name.trim(),
      bio: input.bio?.trim() || null,
      careerYears: input.careerYears ?? 3,
      createdBy: session.adminId,
    })
    .returning();

  revalidatePath("/admin/trainers");
  return ok({ id: created!.id });
}

export async function adminUpdatePolicyAction(input: {
  id: number;
  rawJsonValue: string;
}): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(input.rawJsonValue);
  } catch {
    return fail("VALIDATION_ERROR", "유효한 JSON 값(숫자/문자열/불리언/배열)을 입력해 주세요.");
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(policyConfigs)
    .where(eq(policyConfigs.id, input.id))
    .limit(1);
  if (!existing) return fail("NOT_FOUND", "정책 항목을 찾을 수 없습니다.");

  await db.transaction(async (tx) => {
    await tx
      .update(policyConfigs)
      .set({ value: parsedValue, updatedBy: session.adminId })
      .where(eq(policyConfigs.id, existing.id));

    await tx.insert(policyConfigHistories).values({
      policyConfigId: existing.id,
      key: existing.key,
      oldValue: existing.value,
      newValue: parsedValue,
      adminId: session.adminId,
    });
  });

  await recordAuditLog({
    actorId: session.adminId,
    action: "policy.update",
    entity: "policy_configs",
    entityId: existing.id,
    beforeData: { value: existing.value },
    afterData: { value: parsedValue },
  });

  revalidatePath("/admin/policies");
  return ok({ ok: true });
}

export async function adminCreateBannerAction(input: {
  title: string;
  subtitle?: string;
  linkUrl?: string;
  placement: "HOME" | "SHOP_HOME" | "NOTICE";
  accentToken: string;
}): Promise<ActionResult<{ id: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  const [created] = await db
    .insert(banners)
    .values({
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() || null,
      linkUrl: input.linkUrl?.trim() || "/app?tab=explore",
      placement: input.placement,
      accentToken: input.accentToken,
      isActive: true,
      createdBy: session.adminId,
    })
    .returning();

  revalidatePath("/admin/policies");
  revalidatePath("/app");
  return ok({ id: created!.id });
}

export async function adminSoftDeleteBannerAction(id: number): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  await db
    .update(banners)
    .set({ isDeleted: true, deletedAt: new Date(), deletedBy: session.adminId })
    .where(eq(banners.id, id));

  await recordAuditLog({
    actorId: session.adminId,
    action: "entity.soft_delete",
    entity: "banners",
    entityId: id,
    afterData: { isDeleted: true },
  });

  revalidatePath("/admin/policies");
  revalidatePath("/admin/audit-logs");
  return ok({ ok: true });
}

export async function adminSendNotificationAction(input: {
  title: string;
  body: string;
  deepLink?: string;
  targetUserId?: number | null;
}): Promise<ActionResult<{ sentCount: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  const targets = input.targetUserId
    ? await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, input.targetUserId), eq(users.isDeleted, false)))
    : await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.status, "ACTIVE"), eq(users.isDeleted, false)));

  for (const t of targets) {
    await db.insert(notifications).values({
      userId: t.id,
      kind: "NOTICE",
      title: input.title.trim(),
      body: input.body.trim(),
      deepLink: input.deepLink?.trim() || "/app/my/notifications",
      createdBy: session.adminId,
    });
    await sendPushAdapter({
      userId: t.id,
      title: input.title.trim(),
      body: input.body.trim(),
      deepLink: input.deepLink?.trim(),
    });
  }

  await recordAuditLog({
    actorId: session.adminId,
    action: "notification.send",
    entity: "notifications",
    afterData: { sentCount: targets.length, title: input.title },
  });

  revalidatePath("/admin/notifications");
  return ok({ sentCount: targets.length });
}

export async function adminUpdateTemplateAction(input: {
  id: number;
  title: string;
  body: string;
}): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  await db
    .update(notificationTemplates)
    .set({ title: input.title.trim(), body: input.body.trim(), updatedBy: session.adminId })
    .where(eq(notificationTemplates.id, input.id));

  revalidatePath("/admin/notifications");
  return ok({ ok: true });
}

export async function adminRestoreEntityAction(input: {
  entity: string;
  entityId: number;
}): Promise<ActionResult<{ message: string }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const res = await restoreSoftDeletedEntity(input.entity, input.entityId, session.adminId);
  if (!res.restored) return fail("NOT_FOUND", res.message);

  revalidatePath("/admin/audit-logs");
  revalidatePath("/admin/codes");
  revalidatePath("/admin/education");
  revalidatePath("/admin/products");
  revalidatePath("/admin/policies");
  return ok({ message: res.message });
}
