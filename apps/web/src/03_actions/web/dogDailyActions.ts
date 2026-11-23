"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  and,
  dailyEntries,
  dailyEntryStickers,
  desc,
  dogs,
  eq,
  getDb,
  inArray,
  inquiries,
  isNotNull,
  ne,
  vaccinationRecords,
} from "@repo/db";
import { fail, ok, type ActionResult } from "@repo/types";
import { getCurrentUserSession } from "@/00_lib/session";
import { recordAuditLog } from "@/04_services/shared/auditService";

const dogSchema = z.object({
  dogId: z.coerce.number().int().positive().optional(),
  name: z.string().min(1, "반려견 이름을 입력해 주세요.").max(40),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "생년월일 형식(YYYY-MM-DD)을 확인해 주세요."),
  breedId: z.coerce.number().int().positive().nullable().optional(),
  sizeClass: z.enum(["SMALL", "MEDIUM", "LARGE"]),
  gender: z.enum(["MALE", "FEMALE"]),
  neutered: z.boolean().default(false),
  weightKg: z.string().optional(),
  region: z.string().max(100).optional(),
  profileImage: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === "" || v.startsWith("/api/uploads/dogs/") || v.startsWith("/images/"),
      "올바른 이미지 경로가 아닙니다.",
    )
    .nullable()
    .optional(),
});

export async function upsertDogAction(
  input: z.infer<typeof dogSchema>,
): Promise<ActionResult<{ dogId: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = dogSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
  }

  const db = getDb();
  const data = parsed.data;
  const weightVal = data.weightKg && data.weightKg.trim() !== "" ? data.weightKg.trim() : null;
  const profileImageVal =
    data.profileImage && data.profileImage.trim() !== "" ? data.profileImage.trim() : null;

  if (data.dogId) {
    const [existing] = await db
      .select({ id: dogs.id })
      .from(dogs)
      .where(and(eq(dogs.id, data.dogId), eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
      .limit(1);
    if (!existing) return fail("NOT_FOUND", "반려견 정보를 찾을 수 없습니다.");

    await db
      .update(dogs)
      .set({
        name: data.name.trim(),
        birthDate: data.birthDate,
        breedId: data.breedId ?? null,
        sizeClass: data.sizeClass,
        gender: data.gender,
        neutered: data.neutered,
        weightKg: weightVal,
        region: data.region?.trim() || null,
        ...(data.profileImage !== undefined ? { profileImage: profileImageVal } : {}),
        updatedBy: session.userId,
      })
      .where(eq(dogs.id, existing.id));

    revalidatePath("/app");
    revalidatePath("/app/my");
    revalidatePath("/app/my/dogs");
    revalidatePath("/app/daily");
    revalidatePath("/app/record");
    return ok({ dogId: existing.id });
  }

  const existingDogs = await db
    .select({ id: dogs.id })
    .from(dogs)
    .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)));

  const [created] = await db
    .insert(dogs)
    .values({
      userId: session.userId,
      name: data.name.trim(),
      birthDate: data.birthDate,
      breedId: data.breedId ?? null,
      sizeClass: data.sizeClass,
      gender: data.gender,
      neutered: data.neutered,
      weightKg: weightVal,
      region: data.region?.trim() || null,
      profileImage: profileImageVal,
      isPrimary: existingDogs.length === 0,
      createdBy: session.userId,
    })
    .returning();

  revalidatePath("/app");
  revalidatePath("/app/my");
  revalidatePath("/app/my/dogs");
  revalidatePath("/app/daily");
  revalidatePath("/app/record");
  return ok({ dogId: created!.id });
}

export async function setPrimaryDogAction(dogId: number): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const db = getDb();
  const [target] = await db
    .select({ id: dogs.id })
    .from(dogs)
    .where(and(eq(dogs.id, dogId), eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
    .limit(1);
  if (!target) return fail("NOT_FOUND", "반려견을 찾을 수 없습니다.");

  await db.transaction(async (tx) => {
    await tx
      .update(dogs)
      .set({ isPrimary: false, updatedBy: session.userId })
      .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)));
    await tx
      .update(dogs)
      .set({ isPrimary: true, updatedBy: session.userId })
      .where(eq(dogs.id, dogId));
  });

  revalidatePath("/app");
  revalidatePath("/app/my/dogs");
  revalidatePath("/app/daily");
  revalidatePath("/app/record");
  return ok({ ok: true });
}

export async function deleteDogAction(
  dogId: number,
): Promise<ActionResult<{ ok: true; deletedName: string; promotedName: string | null }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const db = getDb();
  const myDogs = await db
    .select()
    .from(dogs)
    .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
    .orderBy(desc(dogs.createdAt));

  if (myDogs.length <= 1) {
    return fail("REFERENCE_BLOCKED", "최소 1마리의 대표 반려견은 유지해야 합니다.");
  }

  const target = myDogs.find((d) => d.id === dogId);
  if (!target) return fail("NOT_FOUND", "반려견을 찾을 수 없습니다.");

  // 진행 중인 1:1 유료 영상 Q&A가 연결된 반려견은 정산·답변 정합성 보호를 위해 삭제 차단
  const [activeInquiry] = await db
    .select({ id: inquiries.id })
    .from(inquiries)
    .where(
      and(
        eq(inquiries.dogId, dogId),
        eq(inquiries.userId, session.userId),
        eq(inquiries.isDeleted, false),
        inArray(inquiries.status, ["PENDING", "ASSIGNED"]),
      ),
    )
    .limit(1);

  if (activeInquiry) {
    return fail(
      "REFERENCE_BLOCKED",
      "답변 대기 중인 1:1 영상 Q&A가 있어 삭제할 수 없습니다. 답변 완료 또는 문의 취소 후 다시 시도해 주세요.",
    );
  }

  const nextPrimary = target.isPrimary ? (myDogs.find((d) => d.id !== dogId) ?? null) : null;

  await db.transaction(async (tx) => {
    await tx
      .update(dogs)
      .set({
        isDeleted: true,
        isPrimary: false,
        deletedAt: new Date(),
        deletedBy: session.userId,
      })
      .where(and(eq(dogs.id, dogId), eq(dogs.userId, session.userId)));

    if (nextPrimary) {
      await tx
        .update(dogs)
        .set({ isPrimary: true, updatedBy: session.userId })
        .where(and(eq(dogs.id, nextPrimary.id), ne(dogs.isDeleted, true)));
    }
  });

  await recordAuditLog({
    actorType: "USER",
    actorId: session.userId,
    action: "entity.soft_delete",
    entity: "dogs",
    entityId: target.id,
    beforeData: {
      name: target.name,
      isPrimary: target.isPrimary,
      breedId: target.breedId,
    },
    afterData: {
      isDeleted: true,
      promotedDogId: nextPrimary?.id ?? null,
    },
  });

  revalidatePath("/app");
  revalidatePath("/app/my");
  revalidatePath("/app/my/dogs");
  revalidatePath("/app/daily");
  revalidatePath("/app/record");
  revalidatePath("/app/inquiry");
  revalidatePath("/admin/audit-logs");

  return ok({
    ok: true,
    deletedName: target.name,
    promotedName: nextPrimary?.name ?? null,
  });
}

const dailyPhotoUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) =>
      v.startsWith("/api/uploads/daily/") ||
      v.startsWith("/api/uploads/inquiries/") ||
      v.startsWith("/images/"),
    "올바른 이미지 경로가 아닙니다.",
  );

const dailyEntrySchema = z.object({
  dogId: z.coerce.number().int().positive(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식을 확인해 주세요."),
  walked: z.boolean(),
  weightKg: z.string().trim().max(10).nullable().optional(),
  photoUrls: z.array(dailyPhotoUrlSchema).max(5, "사진은 최대 5장까지 첨부할 수 있습니다.").optional(),
  memo: z.string().trim().min(1, "자유 일기를 입력해 주세요.").max(2000),
  removeStickerIds: z.array(z.coerce.number().int().positive()).max(50).optional(),
  stickerKind: z.enum(["POOP", "MEAL", "MEDICINE", "HOSPITAL", "WALK", "CUSTOM"]).optional(),
  stickerNote: z.string().max(300).optional(),
  stickerPhotoUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) =>
        v === "" ||
        v.startsWith("/api/uploads/daily/") ||
        v.startsWith("/api/uploads/inquiries/") ||
        v.startsWith("/images/"),
      "올바른 이미지 경로가 아닙니다.",
    )
    .optional(),
});

function parseIsoDateStrict(raw: string): Date | null {
  const ymd = raw.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const check = new Date(Date.UTC(y!, m! - 1, d!));
  if (
    Number.isNaN(check.getTime()) ||
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m! - 1 ||
    check.getUTCDate() !== d
  ) {
    return null;
  }
  return check;
}

function normalizeWeightKg(raw?: string | null): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw.trim() === "") {
    return { ok: true, value: null };
  }
  const num = Number(raw.trim());
  if (!Number.isFinite(num) || num < 0.1 || num > 150) {
    return { ok: false, error: "체중은 0.1kg ~ 150kg 범위로 입력해 주세요." };
  }
  return { ok: true, value: num.toFixed(2) };
}

/**
 * 반려견의 일상 체중 기록 중 가장 최근 날짜의 체중을 dogs.weight_kg에 자동 동기화한다.
 * - 일상 체중 기록이 1건도 없으면 기존 프로필 체중을 유지한다.
 */
async function syncDogLatestWeight(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  dogId: number,
  userId: number,
): Promise<void> {
  const [latest] = await tx
    .select({ weightKg: dailyEntries.weightKg })
    .from(dailyEntries)
    .where(
      and(
        eq(dailyEntries.dogId, dogId),
        eq(dailyEntries.isDeleted, false),
        isNotNull(dailyEntries.weightKg),
      ),
    )
    .orderBy(desc(dailyEntries.entryDate))
    .limit(1);

  if (latest?.weightKg) {
    await tx
      .update(dogs)
      .set({ weightKg: latest.weightKg, updatedBy: userId })
      .where(and(eq(dogs.id, dogId), eq(dogs.isDeleted, false)));
  }
}

export async function saveDailyEntryAction(
  input: z.infer<typeof dailyEntrySchema>,
): Promise<ActionResult<{ entryId: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = dailyEntrySchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "일상 기록 입력값을 확인해 주세요.");
  }

  const weightResult = normalizeWeightKg(parsed.data.weightKg);
  if (!weightResult.ok) {
    return fail("VALIDATION_ERROR", weightResult.error);
  }

  const db = getDb();
  const [dog] = await db
    .select({ id: dogs.id })
    .from(dogs)
    .where(and(eq(dogs.id, parsed.data.dogId), eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
    .limit(1);
  if (!dog) return fail("FORBIDDEN", "본인 반려견의 기록만 저장할 수 있습니다.");

  const uniquePhotoUrls =
    parsed.data.photoUrls !== undefined
      ? Array.from(new Set(parsed.data.photoUrls)).slice(0, 5)
      : undefined;

  const entryId = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(dailyEntries)
      .where(
        and(
          eq(dailyEntries.dogId, dog.id),
          eq(dailyEntries.entryDate, parsed.data.entryDate),
          eq(dailyEntries.isDeleted, false),
        ),
      )
      .limit(1);

    let id = existing?.id;
    if (existing) {
      await tx
        .update(dailyEntries)
        .set({
          walked: parsed.data.walked,
          weightKg: weightResult.value,
          ...(uniquePhotoUrls !== undefined ? { photoUrls: uniquePhotoUrls } : {}),
          memo: parsed.data.memo?.trim() || null,
          updatedBy: session.userId,
        })
        .where(eq(dailyEntries.id, existing.id));
    } else {
      const [created] = await tx
        .insert(dailyEntries)
        .values({
          dogId: dog.id,
          entryDate: parsed.data.entryDate,
          walked: parsed.data.walked,
          weightKg: weightResult.value,
          photoUrls: uniquePhotoUrls ?? [],
          memo: parsed.data.memo?.trim() || null,
          createdBy: session.userId,
        })
        .returning();
      id = created!.id;
    }

    if (parsed.data.removeStickerIds && parsed.data.removeStickerIds.length > 0) {
      await tx
        .update(dailyEntryStickers)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: session.userId,
        })
        .where(
          and(
            eq(dailyEntryStickers.entryId, id!),
            inArray(dailyEntryStickers.id, parsed.data.removeStickerIds),
            eq(dailyEntryStickers.isDeleted, false),
          ),
        );
    }

    if (parsed.data.stickerKind) {
      await tx.insert(dailyEntryStickers).values({
        entryId: id!,
        kind: parsed.data.stickerKind,
        note: parsed.data.stickerNote?.trim() || null,
        photoUrl: parsed.data.stickerPhotoUrl?.trim() || null,
        createdBy: session.userId,
      });
    }

    if (weightResult.value !== null || existing?.weightKg !== null) {
      await syncDogLatestWeight(tx, dog.id, session.userId);
    }

    return id!;
  });

  revalidatePath("/app");
  revalidatePath("/app/my");
  revalidatePath("/app/my/dogs");
  revalidatePath("/app/daily");
  revalidatePath(`/app/daily/${parsed.data.entryDate}`);
  revalidatePath("/app/record");
  return ok({ entryId });
}

export async function deleteDailyEntryAction(
  entryId: number,
): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const db = getDb();
  const [target] = await db
    .select({
      id: dailyEntries.id,
      dogId: dailyEntries.dogId,
      entryDate: dailyEntries.entryDate,
      weightKg: dailyEntries.weightKg,
    })
    .from(dailyEntries)
    .innerJoin(dogs, eq(dailyEntries.dogId, dogs.id))
    .where(
      and(
        eq(dailyEntries.id, entryId),
        eq(dailyEntries.isDeleted, false),
        eq(dogs.userId, session.userId),
        eq(dogs.isDeleted, false),
      ),
    )
    .limit(1);

  if (!target) return fail("NOT_FOUND", "삭제할 일상 기록을 찾을 수 없습니다.");

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(dailyEntries)
      .set({ isDeleted: true, deletedAt: now, deletedBy: session.userId })
      .where(eq(dailyEntries.id, target.id));

    await tx
      .update(dailyEntryStickers)
      .set({ isDeleted: true, deletedAt: now, deletedBy: session.userId })
      .where(and(eq(dailyEntryStickers.entryId, target.id), eq(dailyEntryStickers.isDeleted, false)));

    if (target.weightKg !== null) {
      await syncDogLatestWeight(tx, target.dogId, session.userId);
    }
  });

  await recordAuditLog({
    actorType: "USER",
    actorId: session.userId,
    action: "entity.soft_delete",
    entity: "daily_entries",
    entityId: target.id,
    beforeData: { dogId: target.dogId, entryDate: target.entryDate, weightKg: target.weightKg },
    afterData: { isDeleted: true },
  });

  revalidatePath("/app");
  revalidatePath("/app/my");
  revalidatePath("/app/my/dogs");
  revalidatePath("/app/daily");
  revalidatePath(`/app/daily/${target.entryDate}`);
  return ok({ ok: true });
}

const vaccinationSchema = z.object({
  dogId: z.coerce.number().int().positive().optional(),
  dogIds: z.array(z.coerce.number().int().positive()).min(1).max(20).optional(),
  vaccineId: z.coerce.number().int().positive(),
  administeredAt: z.string().min(10),
  nextDueAt: z.string().optional(),
  hospital: z.string().max(120).optional(),
  memo: z.string().max(500).optional(),
});

export async function createVaccinationAction(
  input: z.infer<typeof vaccinationSchema>,
): Promise<ActionResult<{ id: number; ids: number[]; count: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = vaccinationSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", "예방접종 정보를 확인해 주세요.");

  const requestedIds = Array.from(
    new Set(
      parsed.data.dogIds && parsed.data.dogIds.length > 0
        ? parsed.data.dogIds
        : parsed.data.dogId
          ? [parsed.data.dogId]
          : [],
    ),
  );
  if (requestedIds.length === 0) {
    return fail("VALIDATION_ERROR", "접종 대상 반려견을 최소 1마리 이상 선택해 주세요.");
  }

  const db = getDb();
  const ownedDogs = await db
    .select({ id: dogs.id })
    .from(dogs)
    .where(
      and(
        inArray(dogs.id, requestedIds),
        eq(dogs.userId, session.userId),
        eq(dogs.isDeleted, false),
      ),
    );
  if (ownedDogs.length !== requestedIds.length) {
    return fail("FORBIDDEN", "본인 반려견만 기록할 수 있습니다.");
  }

  const administeredDate = parseIsoDateStrict(parsed.data.administeredAt);
  if (!administeredDate) {
    return fail("VALIDATION_ERROR", "유효한 접종일을 선택해 주세요.");
  }
  const nextDueDate = parsed.data.nextDueAt ? parseIsoDateStrict(parsed.data.nextDueAt) : null;
  if (parsed.data.nextDueAt && !nextDueDate) {
    return fail("VALIDATION_ERROR", "유효한 다음 접종 예정일을 선택해 주세요.");
  }
  if (nextDueDate && nextDueDate < administeredDate) {
    return fail("VALIDATION_ERROR", "다음 접종 예정일은 접종일 이후로 선택해 주세요.");
  }
  const hospital = parsed.data.hospital?.trim() || null;
  const memo = parsed.data.memo?.trim() || null;

  const createdRows = await db.transaction(async (tx) => {
    return tx
      .insert(vaccinationRecords)
      .values(
        requestedIds.map((targetDogId) => ({
          dogId: targetDogId,
          vaccineId: parsed.data.vaccineId,
          administeredAt: administeredDate,
          nextDueAt: nextDueDate,
          hospital,
          memo,
          createdBy: session.userId,
        })),
      )
      .returning({ id: vaccinationRecords.id });
  });

  const ids = createdRows.map((r) => r.id);
  revalidatePath("/app/daily");
  return ok({ id: ids[0]!, ids, count: ids.length });
}

const updateVaccinationSchema = z.object({
  id: z.coerce.number().int().positive(),
  vaccineId: z.coerce.number().int().positive(),
  administeredAt: z.string().min(10),
  nextDueAt: z.string().optional(),
  hospital: z.string().max(120).optional(),
  memo: z.string().max(500).optional(),
});

export async function updateVaccinationAction(
  input: z.infer<typeof updateVaccinationSchema>,
): Promise<ActionResult<{ id: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = updateVaccinationSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", "예방접종 수정 정보를 확인해 주세요.");

  const db = getDb();
  const [target] = await db
    .select({ id: vaccinationRecords.id })
    .from(vaccinationRecords)
    .innerJoin(dogs, eq(vaccinationRecords.dogId, dogs.id))
    .where(
      and(
        eq(vaccinationRecords.id, parsed.data.id),
        eq(vaccinationRecords.isDeleted, false),
        eq(dogs.userId, session.userId),
        eq(dogs.isDeleted, false),
      ),
    )
    .limit(1);

  if (!target) return fail("NOT_FOUND", "예방접종 기록을 찾을 수 없습니다.");

  const administeredDate = parseIsoDateStrict(parsed.data.administeredAt);
  if (!administeredDate) {
    return fail("VALIDATION_ERROR", "유효한 접종일을 선택해 주세요.");
  }
  const nextDueDate = parsed.data.nextDueAt ? parseIsoDateStrict(parsed.data.nextDueAt) : null;
  if (parsed.data.nextDueAt && !nextDueDate) {
    return fail("VALIDATION_ERROR", "유효한 다음 접종 예정일을 선택해 주세요.");
  }
  if (nextDueDate && nextDueDate < administeredDate) {
    return fail("VALIDATION_ERROR", "다음 접종 예정일은 접종일 이후로 선택해 주세요.");
  }

  await db
    .update(vaccinationRecords)
    .set({
      vaccineId: parsed.data.vaccineId,
      administeredAt: administeredDate,
      nextDueAt: nextDueDate,
      hospital: parsed.data.hospital?.trim() || null,
      memo: parsed.data.memo?.trim() || null,
      updatedBy: session.userId,
    })
    .where(eq(vaccinationRecords.id, target.id));

  revalidatePath("/app/daily");
  return ok({ id: target.id });
}

export async function deleteVaccinationAction(
  id: number,
): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const db = getDb();
  const [target] = await db
    .select({
      id: vaccinationRecords.id,
      dogId: vaccinationRecords.dogId,
      vaccineId: vaccinationRecords.vaccineId,
    })
    .from(vaccinationRecords)
    .innerJoin(dogs, eq(vaccinationRecords.dogId, dogs.id))
    .where(
      and(
        eq(vaccinationRecords.id, id),
        eq(vaccinationRecords.isDeleted, false),
        eq(dogs.userId, session.userId),
        eq(dogs.isDeleted, false),
      ),
    )
    .limit(1);

  if (!target) return fail("NOT_FOUND", "삭제할 예방접종 기록을 찾을 수 없습니다.");

  await db
    .update(vaccinationRecords)
    .set({ isDeleted: true, deletedAt: new Date(), deletedBy: session.userId })
    .where(eq(vaccinationRecords.id, target.id));

  await recordAuditLog({
    actorType: "USER",
    actorId: session.userId,
    action: "entity.soft_delete",
    entity: "vaccination_records",
    entityId: target.id,
    beforeData: { dogId: target.dogId, vaccineId: target.vaccineId },
    afterData: { isDeleted: true },
  });

  revalidatePath("/app/daily");
  return ok({ ok: true });
}
