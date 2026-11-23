"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  and,
  courses,
  courseTags,
  dogs,
  enrollments,
  eq,
  getDb,
  inArray,
  isNotNull,
  lessonProgresses,
  lessons,
  lessonSteps,
  policyConfigHistories,
  policyConfigs,
  practiceChecklists,
  quizQuestions,
  quizzes,
  surveyAnswers,
  surveyQuestions,
  tags,
  units,
} from "@repo/db";
import { calcGradeFromLessonCount, fail, ok, type ActionResult } from "@repo/types";
import { extractYoutubeVideoId, toCanonicalUploadUrl } from "@/00_lib/mediaUrl";
import { getCurrentAdminSession } from "@/00_lib/session";
import { recordAuditLog } from "@/04_services/shared/auditService";
import { getGradeTiersPolicy } from "@/04_services/shared/policyService";

const courseSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  code: z.string().min(2).max(80),
  title: z.string().min(2).max(150),
  description: z.string().max(1000).optional(),
  level: z.coerce.number().int().min(1).max(5),
  isPremium: z.boolean().default(false),
  isPublished: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export async function adminUpsertCourseAction(
  input: z.infer<typeof courseSchema>,
): Promise<ActionResult<{ id: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", "강좌 입력값을 확인해 주세요.");

  const db = getDb();
  const data = parsed.data;

  if (data.id) {
    await db
      .update(courses)
      .set({
        code: data.code.trim().toUpperCase(),
        title: data.title.trim(),
        description: data.description?.trim() || null,
        level: data.level,
        isPremium: data.isPremium,
        isPublished: data.isPublished,
        sortOrder: data.sortOrder,
        updatedBy: session.adminId,
      })
      .where(eq(courses.id, data.id));

    await recordAuditLog({
      actorId: session.adminId,
      action: "course.update",
      entity: "courses",
      entityId: data.id,
      afterData: data,
    });

    revalidatePath("/admin/education");
    revalidatePath(`/admin/education/${data.id}`);
    return ok({ id: data.id });
  }

  const [created] = await db
    .insert(courses)
    .values({
      code: data.code.trim().toUpperCase(),
      title: data.title.trim(),
      description: data.description?.trim() || null,
      level: data.level,
      isPremium: data.isPremium,
      isPublished: data.isPublished,
      sortOrder: data.sortOrder,
      createdBy: session.adminId,
    })
    .returning();

  await recordAuditLog({
    actorId: session.adminId,
    action: "course.create",
    entity: "courses",
    entityId: created!.id,
    afterData: data,
  });

  revalidatePath("/admin/education");
  return ok({ id: created!.id });
}

export async function adminSoftDeleteCourseAction(courseId: number): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  const [enr] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.courseId, courseId), eq(enrollments.isDeleted, false)))
    .limit(1);
  if (enr) {
    return fail("REFERENCE_BLOCKED", "수강 이력이 존재하는 강좌는 삭제할 수 없습니다. 비공개 전환을 이용해 주세요.");
  }

  await db
    .update(courses)
    .set({ isDeleted: true, deletedAt: new Date(), deletedBy: session.adminId })
    .where(eq(courses.id, courseId));

  await recordAuditLog({
    actorId: session.adminId,
    action: "entity.soft_delete",
    entity: "courses",
    entityId: courseId,
    afterData: { isDeleted: true },
  });

  revalidatePath("/admin/education");
  revalidatePath("/admin/audit-logs");
  return ok({ ok: true });
}

export async function adminAddUnitAndLessonAction(input: {
  courseId: number;
  unitTitle: string;
  lessonTitle: string;
  youtubeVideoId?: string;
  videoUrl?: string;
  checklistText: string;
  quizQuestionText: string;
}): Promise<ActionResult<{ lessonId: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  if (!input.unitTitle.trim() || !input.lessonTitle.trim()) {
    return fail("VALIDATION_ERROR", "챕터 제목과 강의 제목을 모두 입력해 주세요.");
  }

  const canonicalVideoUrl = toCanonicalUploadUrl(input.videoUrl?.trim() || "");
  const normalizedYoutubeId = canonicalVideoUrl
    ? null
    : (extractYoutubeVideoId(input.youtubeVideoId) ?? "M7lc1UVf-VE");

  const db = getDb();
  const lessonId = await db.transaction(async (tx) => {
    const existingUnits = await tx
      .select()
      .from(units)
      .where(and(eq(units.courseId, input.courseId), eq(units.isDeleted, false)));
    const nextUnitOrder = existingUnits.length + 1;

    const [u] = await tx
      .insert(units)
      .values({
        courseId: input.courseId,
        title: input.unitTitle.trim(),
        sortOrder: nextUnitOrder,
        createdBy: session.adminId,
      })
      .returning();

    const [l] = await tx
      .insert(lessons)
      .values({
        unitId: u!.id,
        title: input.lessonTitle.trim(),
        summary: "관리자 CMS에서 추가된 강의입니다.",
        sortOrder: 1,
        createdBy: session.adminId,
      })
      .returning();

    await tx.insert(lessonSteps).values({
      lessonId: l!.id,
      type: "VIDEO",
      sortOrder: 1,
      youtubeVideoId: normalizedYoutubeId,
      videoUrl: canonicalVideoUrl || null,
      videoDurationS: 180,
      createdBy: session.adminId,
    });

    const [pStep] = await tx
      .insert(lessonSteps)
      .values({ lessonId: l!.id, type: "PRACTICE", sortOrder: 2, createdBy: session.adminId })
      .returning();

    await tx.insert(practiceChecklists).values({
      stepId: pStep!.id,
      text: input.checklistText.trim() || "실습 체크 항목 완료",
      sortOrder: 1,
      createdBy: session.adminId,
    });

    const [qStep] = await tx
      .insert(lessonSteps)
      .values({ lessonId: l!.id, type: "QUIZ", sortOrder: 3, createdBy: session.adminId })
      .returning();

    const [q] = await tx
      .insert(quizzes)
      .values({ stepId: qStep!.id, createdBy: session.adminId })
      .returning();

    await tx.insert(quizQuestions).values({
      quizId: q!.id,
      text: input.quizQuestionText.trim() || "본 강의의 핵심 원칙은?",
      choices: ["일관된 즉시 보상", "큰 소리로 혼내기", "긴 시간 강제 훈련", "무시하기"],
      answerIndex: 0,
      explanation: "짧고 일관된 긍정 강화가 가장 효과적입니다.",
      sortOrder: 1,
      createdBy: session.adminId,
    });

    return l!.id;
  });

  await recordAuditLog({
    actorId: session.adminId,
    action: "course.add_unit_lesson",
    entity: "courses",
    entityId: input.courseId,
    afterData: {
      lessonId,
      unitTitle: input.unitTitle,
      lessonTitle: input.lessonTitle,
      youtubeVideoId: normalizedYoutubeId,
      videoUrl: canonicalVideoUrl || null,
    },
  });

  revalidatePath(`/admin/education/${input.courseId}`);
  return ok({ lessonId });
}

export async function adminUpdateLessonVideoAction(input: {
  courseId: number;
  lessonId: number;
  youtubeVideoId?: string;
  videoUrl?: string;
}): Promise<ActionResult<{ updated: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const canonicalVideoUrl = toCanonicalUploadUrl(input.videoUrl?.trim() || "");
  const normalizedYoutubeId = canonicalVideoUrl
    ? null
    : extractYoutubeVideoId(input.youtubeVideoId);

  if (!canonicalVideoUrl && !normalizedYoutubeId) {
    return fail("VALIDATION_ERROR", "YouTube 링크 또는 업로드 영상을 등록해 주세요.");
  }

  const db = getDb();
  const [step] = await db
    .select({ id: lessonSteps.id })
    .from(lessonSteps)
    .where(
      and(
        eq(lessonSteps.lessonId, input.lessonId),
        eq(lessonSteps.type, "VIDEO"),
        eq(lessonSteps.isDeleted, false),
      ),
    )
    .limit(1);

  if (step) {
    await db
      .update(lessonSteps)
      .set({
        youtubeVideoId: normalizedYoutubeId,
        videoUrl: canonicalVideoUrl || null,
        updatedBy: session.adminId,
      })
      .where(eq(lessonSteps.id, step.id));
  } else {
    await db.insert(lessonSteps).values({
      lessonId: input.lessonId,
      type: "VIDEO",
      sortOrder: 1,
      youtubeVideoId: normalizedYoutubeId,
      videoUrl: canonicalVideoUrl || null,
      videoDurationS: 180,
      createdBy: session.adminId,
    });
  }

  await recordAuditLog({
    actorId: session.adminId,
    action: "lesson.update_video",
    entity: "lessons",
    entityId: input.lessonId,
    afterData: { youtubeVideoId: normalizedYoutubeId, videoUrl: canonicalVideoUrl || null },
  });

  revalidatePath(`/admin/education/${input.courseId}`);
  revalidatePath(`/app/lesson/${input.lessonId}/watch`);
  return ok({ updated: true });
}

export async function adminCreateTagAction(input: {
  code: string;
  name: string;
  category: typeof tags.$inferInsert.category;
}): Promise<ActionResult<{ id: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  const [created] = await db
    .insert(tags)
    .values({
      code: input.code.trim().toLowerCase(),
      name: input.name.trim(),
      category: input.category,
      createdBy: session.adminId,
    })
    .returning();

  await recordAuditLog({
    actorId: session.adminId,
    action: "tag.create",
    entity: "tags",
    entityId: created!.id,
    afterData: input,
  });

  revalidatePath("/admin/matching/tags");
  return ok({ id: created!.id });
}

export async function adminUpsertCourseTagWeightAction(input: {
  courseId: number;
  tagId: number;
  weight: number;
}): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  const [existing] = await db
    .select()
    .from(courseTags)
    .where(
      and(
        eq(courseTags.courseId, input.courseId),
        eq(courseTags.tagId, input.tagId),
        eq(courseTags.isDeleted, false),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(courseTags)
      .set({ weight: input.weight, updatedBy: session.adminId })
      .where(eq(courseTags.id, existing.id));
  } else {
    await db.insert(courseTags).values({
      courseId: input.courseId,
      tagId: input.tagId,
      weight: input.weight,
      createdBy: session.adminId,
    });
  }

  revalidatePath("/admin/matching");
  return ok({ ok: true });
}

export async function adminCreateSurveyQuestionAction(input: {
  code: string;
  text: string;
  allowMultiple: boolean;
  initialAnswers: string[];
}): Promise<ActionResult<{ id: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const db = getDb();
  const qId = await db.transaction(async (tx) => {
    const existing = await tx.select().from(surveyQuestions).where(eq(surveyQuestions.isDeleted, false));
    const [q] = await tx
      .insert(surveyQuestions)
      .values({
        code: input.code.trim().toUpperCase(),
        text: input.text.trim(),
        allowMultiple: input.allowMultiple,
        sortOrder: existing.length + 1,
        createdBy: session.adminId,
      })
      .returning();

    for (let i = 0; i < input.initialAnswers.length; i++) {
      const txt = input.initialAnswers[i]?.trim();
      if (!txt) continue;
      await tx.insert(surveyAnswers).values({
        questionId: q!.id,
        text: txt,
        sortOrder: i + 1,
        createdBy: session.adminId,
      });
    }
    return q!.id;
  });

  revalidatePath("/admin/matching/survey");
  return ok({ id: qId });
}

const educationPolicyUpdateSchema = z.object({
  gradeTiers: z
    .array(
      z.object({
        grade: z.coerce.number().int().min(1).max(5),
        title: z.string().trim().min(1, "학년 명칭을 입력해 주세요.").max(30),
        minLessons: z.coerce.number().int().min(0).max(10000),
      }),
    )
    .length(5, "강아지 학년은 1~5단계 모두 입력해 주세요."),
  watchCompletePercent: z.coerce.number().int().min(50).max(100),
  quizPassPercent: z.coerce.number().int().min(10).max(100),
  levelTestPassScorePct: z.coerce.number().int().min(10).max(100),
  pointWatch: z.coerce.number().int().min(0).max(100000),
  pointPractice: z.coerce.number().int().min(0).max(100000),
  pointQuiz: z.coerce.number().int().min(0).max(100000),
  pointBonusUnit: z.coerce.number().int().min(0).max(100000),
  pointBonusCourse: z.coerce.number().int().min(0).max(100000),
  pointDailyEarnCap: z.coerce.number().int().min(0).max(1000000),
});

export async function adminUpdateEducationPoliciesAction(
  input: z.infer<typeof educationPolicyUpdateSchema>,
): Promise<ActionResult<{ updatedKeys: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const parsed = educationPolicyUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "교육 정책 입력값을 확인해 주세요.");
  }

  const sortedTiers = [...parsed.data.gradeTiers].sort((a, b) => a.grade - b.grade);
  if (sortedTiers[0]!.grade !== 1 || sortedTiers[0]!.minLessons !== 0) {
    return fail("VALIDATION_ERROR", "1학년 입학 기준은 반드시 0강이어야 합니다.");
  }
  for (let i = 1; i < sortedTiers.length; i += 1) {
    if (sortedTiers[i]!.grade !== i + 1) {
      return fail("VALIDATION_ERROR", "1~5학년 단계가 순차적이어야 합니다.");
    }
    if (sortedTiers[i]!.minLessons <= sortedTiers[i - 1]!.minLessons) {
      return fail(
        "VALIDATION_ERROR",
        `${sortedTiers[i]!.grade}학년 기준 강의 수는 ${sortedTiers[i - 1]!.grade}학년보다 커야 합니다.`,
      );
    }
  }

  const items: Array<{ key: string; value: unknown; description: string }> = [
    {
      key: "grade.tiers",
      value: sortedTiers,
      description: "강아지 1~5학년 승급 기준 (누적 완료 강의 수 · 학년명)",
    },
    { key: "watch.complete_percent", value: parsed.data.watchCompletePercent, description: "영상 시청 완료 판정 비율 (%)" },
    { key: "quiz.pass_percent", value: parsed.data.quizPassPercent, description: "퀴즈 기본 통과 기준 (%)" },
    { key: "level_test.pass_score_pct", value: parsed.data.levelTestPassScorePct, description: "레벨테스트 통과 기준 (%)" },
    { key: "point.watch", value: parsed.data.pointWatch, description: "강의 영상 시청 완료 최초 적립 포인트" },
    { key: "point.practice", value: parsed.data.pointPractice, description: "강의 실습 자가체크 완료 최초 적립 포인트" },
    { key: "point.quiz", value: parsed.data.pointQuiz, description: "강의 퀴즈 최초 통과 적립 포인트" },
    { key: "point.bonus.unit", value: parsed.data.pointBonusUnit, description: "챕터 완주 보너스 포인트" },
    { key: "point.bonus.course", value: parsed.data.pointBonusCourse, description: "강좌 완주 보너스 포인트" },
    { key: "point.daily_earn_cap", value: parsed.data.pointDailyEarnCap, description: "일일 교육 적립 포인트 상한" },
  ];

  const db = getDb();
  let updatedKeys = 0;

  await db.transaction(async (tx) => {
    for (const item of items) {
      const [existing] = await tx
        .select()
        .from(policyConfigs)
        .where(and(eq(policyConfigs.key, item.key), eq(policyConfigs.isDeleted, false)))
        .limit(1);

      if (existing) {
        const unchanged = JSON.stringify(existing.value) === JSON.stringify(item.value);
        if (unchanged) continue;

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
        updatedKeys += 1;
      } else {
        const [inserted] = await tx
          .insert(policyConfigs)
          .values({
            key: item.key,
            value: item.value,
            description: item.description,
            createdBy: session.adminId,
          })
          .returning();
        if (inserted) {
          await tx.insert(policyConfigHistories).values({
            policyConfigId: inserted.id,
            key: inserted.key,
            oldValue: null,
            newValue: item.value,
            adminId: session.adminId,
          });
          updatedKeys += 1;
        }
      }
    }
  });

  await recordAuditLog({
    actorId: session.adminId,
    action: "policy.education_bulk_update",
    entity: "policy_configs",
    afterData: { updatedKeys, ...parsed.data, gradeTiers: sortedTiers },
  });

  revalidatePath("/admin/education");
  revalidatePath("/admin/policies");
  revalidatePath("/app");
  revalidatePath("/app/record");
  revalidatePath("/app/courses");
  return ok({ updatedKeys });
}

export async function adminSyncAllDogGradesAction(input?: {
  allowDemotion?: boolean;
}): Promise<ActionResult<{ totalDogs: number; updatedCount: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const allowDemotion = Boolean(input?.allowDemotion);
  const gradeTiers = await getGradeTiersPolicy();
  const db = getDb();

  const [allDogs, completedRows] = await Promise.all([
    db
      .select({ id: dogs.id, grade: dogs.grade })
      .from(dogs)
      .where(eq(dogs.isDeleted, false)),
    db
      .select({ dogId: lessonProgresses.dogId })
      .from(lessonProgresses)
      .where(and(isNotNull(lessonProgresses.completedAt), eq(lessonProgresses.isDeleted, false))),
  ]);

  const countByDog = new Map<number, number>();
  for (const row of completedRows) {
    countByDog.set(row.dogId, (countByDog.get(row.dogId) ?? 0) + 1);
  }

  let updatedCount = 0;
  await db.transaction(async (tx) => {
    for (const dog of allDogs) {
      const doneCount = countByDog.get(dog.id) ?? 0;
      const nextGrade = calcGradeFromLessonCount(doneCount, gradeTiers, dog.grade, !allowDemotion);
      if (nextGrade !== dog.grade) {
        await tx
          .update(dogs)
          .set({ grade: nextGrade, updatedBy: session.adminId })
          .where(eq(dogs.id, dog.id));
        updatedCount += 1;
      }
    }
  });

  await recordAuditLog({
    actorId: session.adminId,
    action: "dogs.grade_bulk_sync",
    entity: "dogs",
    afterData: { totalDogs: allDogs.length, updatedCount, allowDemotion },
  });

  revalidatePath("/admin/education");
  revalidatePath("/app");
  revalidatePath("/app/record");
  return ok({ totalDogs: allDogs.length, updatedCount });
}

const bulkCourseUpdateSchema = z.object({
  courseIds: z.array(z.coerce.number().int().positive()).min(1, "대상 강좌를 1개 이상 선택해 주세요.").max(500),
  level: z.coerce.number().int().min(1).max(5).optional(),
  isPremium: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

export async function adminBulkUpdateCoursesAction(
  input: z.infer<typeof bulkCourseUpdateSchema>,
): Promise<ActionResult<{ updatedCount: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "권한이 없습니다.");

  const parsed = bulkCourseUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "일괄 변경 입력값을 확인해 주세요.");
  }

  const { courseIds, level, isPremium, isPublished } = parsed.data;
  if (level === undefined && isPremium === undefined && isPublished === undefined) {
    return fail("VALIDATION_ERROR", "변경할 항목(레벨 · 유형 · 게시 상태)을 최소 1개 선택해 주세요.");
  }

  const patch: Partial<typeof courses.$inferInsert> = {
    updatedBy: session.adminId,
  };
  if (level !== undefined) patch.level = level;
  if (isPremium !== undefined) patch.isPremium = isPremium;
  if (isPublished !== undefined) patch.isPublished = isPublished;

  const db = getDb();
  const updated = await db
    .update(courses)
    .set(patch)
    .where(and(inArray(courses.id, courseIds), eq(courses.isDeleted, false)))
    .returning({ id: courses.id });

  await recordAuditLog({
    actorId: session.adminId,
    action: "course.bulk_update",
    entity: "courses",
    afterData: { courseIds, level, isPremium, isPublished, updatedCount: updated.length },
  });

  revalidatePath("/admin/education");
  revalidatePath("/app");
  revalidatePath("/app/courses");
  revalidatePath("/app/record");
  return ok({ updatedCount: updated.length });
}
