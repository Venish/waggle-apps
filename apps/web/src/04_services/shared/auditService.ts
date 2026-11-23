import "server-only";
import { headers } from "next/headers";
import {
  admins,
  auditLogs,
  banners,
  breeds,
  commonCodes,
  courses,
  dailyEntries,
  dogs,
  eq,
  getDb,
  productCategories,
  products,
  surveyQuestions,
  tags,
  trainers,
  vaccinationRecords,
} from "@repo/db";

export async function recordAuditLog(input: {
  actorType?: "ADMIN" | "USER" | "SYSTEM";
  actorId?: number | null;
  action: string;
  entity?: string;
  entityId?: number | null;
  beforeData?: unknown;
  afterData?: unknown;
}): Promise<void> {
  const db = getDb();
  let ipAddress = "127.0.0.1";
  let userAgent: string | null = null;
  try {
    const hdrs = await headers();
    ipAddress = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
    userAgent = hdrs.get("user-agent");
  } catch {
    // cron/background context
  }

  await db.insert(auditLogs).values({
    actorType: input.actorType ?? "ADMIN",
    actorId: input.actorId ?? null,
    action: input.action,
    entity: input.entity ?? null,
    entityId: input.entityId ?? null,
    beforeData: input.beforeData ?? null,
    afterData: input.afterData ?? null,
    ipAddress,
    userAgent,
  });
}

const RESTORABLE_TABLES = {
  admins,
  banners,
  breeds,
  common_codes: commonCodes,
  courses,
  daily_entries: dailyEntries,
  dogs,
  product_categories: productCategories,
  products,
  survey_questions: surveyQuestions,
  tags,
  trainers,
  vaccination_records: vaccinationRecords,
} as const;

export type RestorableEntityName = keyof typeof RESTORABLE_TABLES;

export async function restoreSoftDeletedEntity(
  entity: string,
  entityId: number,
  adminId: number,
): Promise<{ restored: boolean; message: string }> {
  if (!(entity in RESTORABLE_TABLES)) {
    return { restored: false, message: `복원 지원 대상이 아닌 엔티티입니다: ${entity}` };
  }
  const table = RESTORABLE_TABLES[entity as RestorableEntityName];
  const db = getDb();

  const updated = await db
    .update(table)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      updatedBy: adminId,
    })
    .where(eq(table.id, entityId))
    .returning({ id: table.id });

  if (updated.length === 0) {
    return { restored: false, message: "복원할 대상 레코드를 찾을 수 없습니다." };
  }

  await recordAuditLog({
    actorType: "ADMIN",
    actorId: adminId,
    action: "entity.restore",
    entity,
    entityId,
    afterData: { isDeleted: false },
  });

  return { restored: true, message: `${entity} #${entityId} 복원이 완료되었습니다.` };
}
