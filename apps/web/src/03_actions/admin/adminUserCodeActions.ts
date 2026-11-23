"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  and,
  breeds,
  commonCodes,
  dogs,
  eq,
  getDb,
  users,
  vaccinationRecords,
} from "@repo/db";
import { fail, ok, type ActionResult } from "@repo/types";
import { getCurrentAdminSession, revokeAllUserSessions } from "@/00_lib/session";
import { recordAuditLog } from "@/04_services/shared/auditService";
import { earnPointsTx, spendPointsFifoTx } from "@/04_services/shared/pointLedgerService";

export async function adminUpdateUserStatusAction(input: {
  userId: number;
  status: "ACTIVE" | "SUSPENDED";
}): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  await db
    .update(users)
    .set({ status: input.status, updatedBy: session.adminId })
    .where(eq(users.id, input.userId));

  if (input.status === "SUSPENDED") {
    await revokeAllUserSessions(input.userId, "ADMIN_FORCE");
  }

  await recordAuditLog({
    actorId: session.adminId,
    action: "user.status_update",
    entity: "users",
    entityId: input.userId,
    afterData: { status: input.status },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${input.userId}`);
  return ok({ ok: true });
}

export async function adminForceRevokeUserSessionAction(
  userId: number,
): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  await revokeAllUserSessions(userId, "ADMIN_FORCE");
  await recordAuditLog({
    actorId: session.adminId,
    action: "user.force_logout",
    entity: "users",
    entityId: userId,
  });

  revalidatePath(`/admin/users/${userId}`);
  return ok({ ok: true });
}

const adjustPointSchema = z.object({
  userId: z.coerce.number().int().positive(),
  mode: z.enum(["GRANT", "REVOKE"]),
  amount: z.coerce.number().int().positive(),
  memo: z.string().min(2, "조정 사유를 입력해 주세요.").max(200),
});

export async function adminAdjustUserPointsAction(
  input: z.infer<typeof adjustPointSchema>,
): Promise<ActionResult<{ balanceAfter: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const parsed = adjustPointSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
  }

  const db = getDb();
  try {
    const balanceAfter = await db.transaction(async (tx) => {
      if (parsed.data.mode === "GRANT") {
        const res = await earnPointsTx(tx, {
          userId: parsed.data.userId,
          amount: parsed.data.amount,
          reason: "ADMIN_GRANT",
          refType: "admin_adjust",
          memo: parsed.data.memo.trim(),
          actorId: session.adminId,
        });
        return res.balanceAfter;
      }
      const res = await spendPointsFifoTx(tx, {
        userId: parsed.data.userId,
        amount: parsed.data.amount,
        reason: "ADMIN_REVOKE",
        refType: "admin_adjust",
        memo: parsed.data.memo.trim(),
        actorId: session.adminId,
      });
      return res.balanceAfter;
    });

    await recordAuditLog({
      actorId: session.adminId,
      action: parsed.data.mode === "GRANT" ? "point.admin_grant" : "point.admin_revoke",
      entity: "users",
      entityId: parsed.data.userId,
      afterData: { amount: parsed.data.amount, memo: parsed.data.memo, balanceAfter },
    });

    revalidatePath(`/admin/users/${parsed.data.userId}`);
    return ok({ balanceAfter });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_POINTS") {
      return fail("INSUFFICIENT_POINTS", "회원의 잔여 포인트보다 큰 금액을 회수할 수 없습니다.");
    }
    return fail("INTERNAL_ERROR", "포인트 조정에 실패했습니다.");
  }
}

const commonCodeSchema = z.object({
  codeGroup: z.string().min(2).max(60),
  code: z.string().min(2).max(60),
  codeKorName: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export async function adminCreateCommonCodeAction(
  input: z.infer<typeof commonCodeSchema>,
): Promise<ActionResult<{ id: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const parsed = commonCodeSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", "공통코드 필드를 확인해 주세요.");

  const db = getDb();
  const [created] = await db
    .insert(commonCodes)
    .values({
      codeGroup: parsed.data.codeGroup.trim().toUpperCase(),
      code: parsed.data.code.trim().toUpperCase(),
      codeKorName: parsed.data.codeKorName.trim(),
      description: parsed.data.description?.trim() || null,
      sortOrder: parsed.data.sortOrder,
      createdBy: session.adminId,
    })
    .returning();

  await recordAuditLog({
    actorId: session.adminId,
    action: "common_code.create",
    entity: "common_codes",
    entityId: created!.id,
    afterData: parsed.data,
  });

  revalidatePath("/admin/codes");
  return ok({ id: created!.id });
}

export async function adminSoftDeleteCommonCodeAction(id: number): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  // 참조 데이터 삭제 원천 차단 (vaccination_records)
  const [ref] = await db
    .select({ id: vaccinationRecords.id })
    .from(vaccinationRecords)
    .where(and(eq(vaccinationRecords.vaccineId, id), eq(vaccinationRecords.isDeleted, false)))
    .limit(1);

  if (ref) {
    return fail(
      "REFERENCE_BLOCKED",
      "해당 공통코드를 참조하는 예방접종 기록이 존재하여 삭제할 수 없습니다.",
    );
  }

  await db
    .update(commonCodes)
    .set({ isDeleted: true, deletedAt: new Date(), deletedBy: session.adminId })
    .where(eq(commonCodes.id, id));

  await recordAuditLog({
    actorId: session.adminId,
    action: "entity.soft_delete",
    entity: "common_codes",
    entityId: id,
    afterData: { isDeleted: true },
  });

  revalidatePath("/admin/codes");
  revalidatePath("/admin/audit-logs");
  return ok({ ok: true });
}

const breedSchema = z.object({
  code: z.string().min(2).max(60),
  nameKo: z.string().min(1).max(80),
  nameEn: z.string().min(1).max(100),
  defaultSize: z.enum(["SMALL", "MEDIUM", "LARGE"]),
});

export async function adminCreateBreedAction(
  input: z.infer<typeof breedSchema>,
): Promise<ActionResult<{ id: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const parsed = breedSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", "견종 정보를 확인해 주세요.");

  const db = getDb();
  const [created] = await db
    .insert(breeds)
    .values({
      code: parsed.data.code.trim().toUpperCase(),
      nameKo: parsed.data.nameKo.trim(),
      nameEn: parsed.data.nameEn.trim(),
      defaultSize: parsed.data.defaultSize,
      createdBy: session.adminId,
    })
    .returning();

  await recordAuditLog({
    actorId: session.adminId,
    action: "breed.create",
    entity: "breeds",
    entityId: created!.id,
    afterData: parsed.data,
  });

  revalidatePath("/admin/codes");
  return ok({ id: created!.id });
}

export async function adminSoftDeleteBreedAction(id: number): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  const [ref] = await db
    .select({ id: dogs.id })
    .from(dogs)
    .where(and(eq(dogs.breedId, id), eq(dogs.isDeleted, false)))
    .limit(1);

  if (ref) {
    return fail("REFERENCE_BLOCKED", "이 견종으로 등록된 반려견 프로필이 존재하여 삭제할 수 없습니다.");
  }

  await db
    .update(breeds)
    .set({ isDeleted: true, deletedAt: new Date(), deletedBy: session.adminId })
    .where(eq(breeds.id, id));

  await recordAuditLog({
    actorId: session.adminId,
    action: "entity.soft_delete",
    entity: "breeds",
    entityId: id,
    afterData: { isDeleted: true },
  });

  revalidatePath("/admin/codes");
  revalidatePath("/admin/audit-logs");
  return ok({ ok: true });
}
