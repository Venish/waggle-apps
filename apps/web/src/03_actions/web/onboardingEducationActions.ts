"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  and,
  asc,
  badges,
  courses,
  courseUnlocks,
  dailyGoals,
  dogBadges,
  dogs,
  enrollments,
  eq,
  getDb,
  inArray,
  isNotNull,
  lessonProgresses,
  lessons,
  lessonSteps,
  levelTestAttempts,
  levelTests,
  notifications,
  quizAttempts,
  quizQuestions,
  quizzes,
  surveyResponses,
  units,
  users,
} from "@repo/db";
import {
  calcGradeFromLessonCount,
  fail,
  gradeQuiz,
  ok,
  type ActionResult,
} from "@repo/types";
import { getCurrentUserSession } from "@/00_lib/session";
import { recordAuditLog } from "@/04_services/shared/auditService";
import { earnPointsTx } from "@/04_services/shared/pointLedgerService";
import {
  getGradeTiersPolicy,
  getPolicyBoolean,
  getPolicyNumber,
} from "@/04_services/shared/policyService";

async function getPrimaryDog(userId: number) {
  const db = getDb();
  const list = await db
    .select()
    .from(dogs)
    .where(and(eq(dogs.userId, userId), eq(dogs.isDeleted, false)))
    .orderBy(asc(dogs.id));
  return list.find((d) => d.isPrimary) ?? list[0] ?? null;
}

const surveySubmitSchema = z.object({
  answerIds: z.array(z.coerce.number().int().positive()).min(1, "최소 1개 이상 선택해 주세요."),
});

export async function saveSurveyResponsesAction(
  input: z.infer<typeof surveySubmitSchema>,
): Promise<ActionResult<{ savedCount: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = surveySubmitSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", "설문 응답을 선택해 주세요.");

  const dog = await getPrimaryDog(session.userId);
  if (!dog) return fail("NOT_FOUND", "먼저 반려견 프로필을 등록해 주세요.");

  const db = getDb();
  const uniqueIds = [...new Set(parsed.data.answerIds)];

  await db.transaction(async (tx) => {
    await tx
      .update(surveyResponses)
      .set({ isDeleted: true, deletedAt: new Date(), deletedBy: session.userId })
      .where(and(eq(surveyResponses.dogId, dog.id), eq(surveyResponses.isDeleted, false)));

    for (const answerId of uniqueIds) {
      await tx.insert(surveyResponses).values({
        dogId: dog.id,
        answerId,
        createdBy: session.userId,
      });
    }
  });

  revalidatePath("/app/onboarding/result");
  return ok({ savedCount: uniqueIds.length });
}

const levelTestSubmitSchema = z.object({
  levelTestId: z.coerce.number().int().positive(),
  selectedIndexes: z.array(z.coerce.number().int().min(0).max(3)).min(1),
});

export async function submitLevelTestAction(
  input: z.infer<typeof levelTestSubmitSchema>,
): Promise<ActionResult<{ score: number; total: number; percent: number; passed: boolean; skippedLessons: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = levelTestSubmitSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", "모든 문항에 답안을 선택해 주세요.");

  const dog = await getPrimaryDog(session.userId);
  if (!dog) return fail("NOT_FOUND", "반려견 정보가 없습니다.");

  const db = getDb();
  const [lt] = await db
    .select()
    .from(levelTests)
    .where(and(eq(levelTests.id, parsed.data.levelTestId), eq(levelTests.isDeleted, false)))
    .limit(1);
  if (!lt) return fail("NOT_FOUND", "레벨테스트를 찾을 수 없습니다.");

  const passPct = lt.passPercentOverride ?? (await getPolicyNumber("level_test.pass_score_pct"));
  const correctIndexes = lt.questions.map((q) => q.answerIndex);
  const graded = gradeQuiz(parsed.data.selectedIndexes, correctIndexes, passPct);

  const [bonusEnabled, bonusPoints, gradeTiers] = await Promise.all([
    getPolicyBoolean("level_test.bonus_enabled"),
    getPolicyNumber("level_test.bonus_points"),
    getGradeTiersPolicy(),
  ]);

  const skippedLessons = await db.transaction(async (tx) => {
    await tx.insert(levelTestAttempts).values({
      levelTestId: lt.id,
      dogId: dog.id,
      answers: parsed.data.selectedIndexes,
      score: graded.score,
      total: graded.total,
      passed: graded.passed,
      createdBy: session.userId,
    });

    if (!graded.passed) return 0;

    // 통과 시 skipToUnitOrder 미만 유닛의 레슨 일괄 이수 처리 (포인트 소급 지급 차단)
    const courseUnits = await tx
      .select()
      .from(units)
      .where(and(eq(units.courseId, lt.courseId), eq(units.isDeleted, false)));

    const skipUnitIds = courseUnits
      .filter((u) => u.sortOrder < lt.skipToUnitOrder)
      .map((u) => u.id);

    let count = 0;
    if (skipUnitIds.length > 0) {
      const targetLessons = await tx
        .select()
        .from(lessons)
        .where(and(inArray(lessons.unitId, skipUnitIds), eq(lessons.isDeleted, false)));

      const now = new Date();
      for (const l of targetLessons) {
        const [exist] = await tx
          .select()
          .from(lessonProgresses)
          .where(
            and(
              eq(lessonProgresses.dogId, dog.id),
              eq(lessonProgresses.lessonId, l.id),
              eq(lessonProgresses.isDeleted, false),
            ),
          )
          .limit(1);

        if (!exist) {
          await tx.insert(lessonProgresses).values({
            dogId: dog.id,
            lessonId: l.id,
            watchMaxPercent: 100,
            watchCompletedAt: now,
            practiceCompletedAt: now,
            quizPassedAt: now,
            completedAt: now,
            completedVia: "LEVEL_TEST",
            watchPointAwarded: true,
            practicePointAwarded: true,
            quizPointAwarded: true,
            createdBy: session.userId,
          });
          count += 1;
        }
      }
    }

    if (bonusEnabled && bonusPoints > 0) {
      await earnPointsTx(tx, {
        userId: session.userId,
        dogId: dog.id,
        amount: bonusPoints,
        reason: "EARN_LEVEL_TEST",
        idempotencyKey: `level_test:${dog.id}:${lt.id}`,
        refType: "level_test",
        refId: lt.id,
        memo: `${lt.title} 통과 보너스`,
      });
    }

    if (count > 0) {
      const allCompleted = await tx
        .select({ id: lessonProgresses.id })
        .from(lessonProgresses)
        .where(
          and(
            eq(lessonProgresses.dogId, dog.id),
            isNotNull(lessonProgresses.completedAt),
            eq(lessonProgresses.isDeleted, false),
          ),
        );
      const nextGrade = calcGradeFromLessonCount(allCompleted.length, gradeTiers, dog.grade, true);
      if (nextGrade !== dog.grade) {
        await tx
          .update(dogs)
          .set({ grade: nextGrade, updatedBy: session.userId })
          .where(eq(dogs.id, dog.id));
      }
    }

    return count;
  });

  revalidatePath("/app");
  revalidatePath("/app/record");
  revalidatePath(`/app/courses/${lt.courseId}`);
  return ok({ ...graded, skippedLessons });
}

export async function enrollCourseAction(
  courseId: number,
  dogId?: number,
): Promise<ActionResult<{ courseId: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const db = getDb();
  const [course] = await db
    .select({ id: courses.id, isPremium: courses.isPremium, isPublished: courses.isPublished })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.isDeleted, false)))
    .limit(1);
  if (!course || !course.isPublished) {
    return fail("NOT_FOUND", "수강 가능한 교육 코스를 찾을 수 없습니다.");
  }

  if (course.isPremium) {
    const [unlocked] = await db
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
    if (!unlocked) {
      return fail("FORBIDDEN", "포인트샵에서 프리미엄 코스를 먼저 잠금 해제해 주세요.");
    }
  }

  let targetDogId = dogId;
  if (targetDogId) {
    const [owned] = await db
      .select({ id: dogs.id })
      .from(dogs)
      .where(and(eq(dogs.id, targetDogId), eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
      .limit(1);
    if (!owned) return fail("FORBIDDEN", "본인 반려견에만 코스를 담을 수 있습니다.");
  } else {
    const primary = await getPrimaryDog(session.userId);
    if (!primary) return fail("NOT_FOUND", "먼저 반려견 프로필을 등록해 주세요.");
    targetDogId = primary.id;
  }

  const [existing] = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.dogId, targetDogId),
        eq(enrollments.courseId, courseId),
        eq(enrollments.isDeleted, false),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(enrollments).values({
      dogId: targetDogId,
      courseId,
      status: "IN_PROGRESS",
      createdBy: session.userId,
    });
  }

  revalidatePath("/app");
  revalidatePath("/app/record");
  revalidatePath(`/app/courses/${courseId}`);
  return ok({ courseId });
}

const unenrollSchema = z.object({
  courseId: z.coerce.number().int().positive(),
  dogId: z.coerce.number().int().positive().optional(),
});

/**
 * 내 교육 목록에서 코스 빼기 (소프트 삭제 · 기존 레슨 이수 기록 및 포인트 보존)
 * - 다시 신청하면 이전 진도 그대로 이어서 학습할 수 있다.
 */
export async function unenrollCourseAction(
  input: z.infer<typeof unenrollSchema>,
): Promise<ActionResult<{ courseId: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = unenrollSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", "코스 정보를 확인해 주세요.");

  const db = getDb();
  let targetDogId = parsed.data.dogId;
  if (targetDogId) {
    const [owned] = await db
      .select({ id: dogs.id })
      .from(dogs)
      .where(and(eq(dogs.id, targetDogId), eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
      .limit(1);
    if (!owned) return fail("FORBIDDEN", "본인 반려견의 수강 코스만 변경할 수 있습니다.");
  } else {
    const primary = await getPrimaryDog(session.userId);
    if (!primary) return fail("NOT_FOUND", "반려견 정보가 없습니다.");
    targetDogId = primary.id;
  }

  const [existing] = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.dogId, targetDogId),
        eq(enrollments.courseId, parsed.data.courseId),
        eq(enrollments.isDeleted, false),
      ),
    )
    .limit(1);

  if (!existing) {
    return fail("NOT_FOUND", "이미 내 교육 목록에서 제외된 코스입니다.");
  }

  await db
    .update(enrollments)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: session.userId,
    })
    .where(eq(enrollments.id, existing.id));

  await recordAuditLog({
    actorType: "USER",
    actorId: session.userId,
    action: "entity.soft_delete",
    entity: "enrollments",
    entityId: existing.id,
    beforeData: { dogId: targetDogId, courseId: parsed.data.courseId, status: existing.status },
    afterData: { isDeleted: true },
  });

  revalidatePath("/app");
  revalidatePath("/app/record");
  revalidatePath(`/app/courses/${parsed.data.courseId}`);
  return ok({ courseId: parsed.data.courseId });
}

const goalSchema = z.object({
  dailyLessonGoal: z.coerce.number().int().min(1).max(10),
  reminderEnabled: z.boolean(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  reminderDays: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .optional(),
  completeOnboarding: z.boolean().optional(),
});

export async function saveDailyGoalAction(
  input: z.infer<typeof goalSchema>,
): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", "목표 설정 값을 확인해 주세요.");

  const normalizedDays = Array.from(
    new Set(parsed.data.reminderDays ?? [0, 1, 2, 3, 4, 5, 6]),
  ).sort((a, b) => a - b);

  if (parsed.data.reminderEnabled && normalizedDays.length === 0) {
    return fail("VALIDATION_ERROR", "반복할 요일을 최소 1개 이상 선택해 주세요.");
  }

  const db = getDb();
  await db.transaction(async (tx) => {
    const [exist] = await tx
      .select()
      .from(dailyGoals)
      .where(and(eq(dailyGoals.userId, session.userId), eq(dailyGoals.isDeleted, false)))
      .limit(1);

    if (exist) {
      await tx
        .update(dailyGoals)
        .set({
          dailyLessonGoal: parsed.data.dailyLessonGoal,
          reminderEnabled: parsed.data.reminderEnabled,
          reminderTime: parsed.data.reminderTime,
          reminderDays: normalizedDays.length > 0 ? normalizedDays : [0, 1, 2, 3, 4, 5, 6],
          updatedBy: session.userId,
        })
        .where(eq(dailyGoals.id, exist.id));
    } else {
      await tx.insert(dailyGoals).values({
        userId: session.userId,
        dailyLessonGoal: parsed.data.dailyLessonGoal,
        reminderEnabled: parsed.data.reminderEnabled,
        reminderTime: parsed.data.reminderTime,
        reminderDays: normalizedDays.length > 0 ? normalizedDays : [0, 1, 2, 3, 4, 5, 6],
        createdBy: session.userId,
      });
    }

    if (parsed.data.completeOnboarding) {
      await tx
        .update(users)
        .set({ onboardingCompletedAt: new Date(), updatedBy: session.userId })
        .where(eq(users.id, session.userId));
    }
  });

  revalidatePath("/app");
  revalidatePath("/app/my/goal");
  return ok({ ok: true });
}

/** 프리미엄 레슨 직접 호출 페이월 검증 (미잠금해제 시 에러 반환) */
async function checkLessonAccess(
  userId: number,
  lessonId: number,
): Promise<ActionResult<{ courseId: number }>> {
  const db = getDb();
  const [row] = await db
    .select({
      courseId: courses.id,
      isPremium: courses.isPremium,
      isPublished: courses.isPublished,
    })
    .from(lessons)
    .innerJoin(units, and(eq(units.id, lessons.unitId), eq(units.isDeleted, false)))
    .innerJoin(courses, and(eq(courses.id, units.courseId), eq(courses.isDeleted, false)))
    .where(and(eq(lessons.id, lessonId), eq(lessons.isDeleted, false)))
    .limit(1);

  if (!row || !row.isPublished) {
    return fail("NOT_FOUND", "수강 가능한 레슨을 찾을 수 없습니다.");
  }

  if (row.isPremium) {
    const [unlocked] = await db
      .select({ id: courseUnlocks.id })
      .from(courseUnlocks)
      .where(
        and(
          eq(courseUnlocks.userId, userId),
          eq(courseUnlocks.courseId, row.courseId),
          eq(courseUnlocks.isDeleted, false),
        ),
      )
      .limit(1);
    if (!unlocked) {
      return fail("FORBIDDEN", "프리미엄 코스를 먼저 잠금 해제해 주세요.");
    }
  }

  return ok({ courseId: row.courseId });
}

/** 1단계 영상 시청 완료 (95% 판정 + 최초 1회 포인트 적립) */
export async function completeLessonWatchAction(input: {
  lessonId: number;
  watchedPercent: number;
}): Promise<ActionResult<{ awardedPoints: number; watchCompleted: boolean }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const access = await checkLessonAccess(session.userId, input.lessonId);
  if (!access.ok) return access;

  const dog = await getPrimaryDog(session.userId);
  if (!dog) return fail("NOT_FOUND", "반려견 프로필이 없습니다.");

  const requiredPct = await getPolicyNumber("watch.complete_percent");
  const watchPoint = await getPolicyNumber("point.watch");
  const pct = Math.min(100, Math.max(0, Math.floor(input.watchedPercent)));
  const reached = pct >= requiredPct;

  const db = getDb();
  const awardedPoints = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(lessonProgresses)
      .where(
        and(
          eq(lessonProgresses.dogId, dog.id),
          eq(lessonProgresses.lessonId, input.lessonId),
          eq(lessonProgresses.isDeleted, false),
        ),
      )
      .limit(1);

    const now = new Date();
    let shouldAward = false;

    if (!existing) {
      await tx.insert(lessonProgresses).values({
        dogId: dog.id,
        lessonId: input.lessonId,
        watchMaxPercent: pct,
        watchCompletedAt: reached ? now : null,
        watchPointAwarded: reached,
        createdBy: session.userId,
      });
      shouldAward = reached;
    } else {
      const nextMax = Math.max(existing.watchMaxPercent, pct);
      shouldAward = reached && !existing.watchPointAwarded;
      await tx
        .update(lessonProgresses)
        .set({
          watchMaxPercent: nextMax,
          watchCompletedAt: existing.watchCompletedAt ?? (reached ? now : null),
          watchPointAwarded: existing.watchPointAwarded || reached,
          updatedBy: session.userId,
        })
        .where(eq(lessonProgresses.id, existing.id));
    }

    if (!shouldAward) return 0;

    const earned = await earnPointsTx(tx, {
      userId: session.userId,
      dogId: dog.id,
      amount: watchPoint,
      reason: "EARN_EDUCATION_WATCH",
      idempotencyKey: `lesson:${dog.id}:${input.lessonId}:watch`,
      refType: "lesson",
      refId: input.lessonId,
      memo: `레슨 #${input.lessonId} 영상 시청 완료`,
      enforceDailyEducationCap: true,
    });
    return earned.awardedAmount;
  });

  revalidatePath(`/app/lesson/${input.lessonId}`);
  revalidatePath("/app/wallet");
  return ok({ awardedPoints, watchCompleted: reached });
}

/** 2단계 실습 자가체크 완료 (최초 1회 포인트 적립) */
export async function completeLessonPracticeAction(
  lessonId: number,
): Promise<ActionResult<{ awardedPoints: number }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const access = await checkLessonAccess(session.userId, lessonId);
  if (!access.ok) return access;

  const dog = await getPrimaryDog(session.userId);
  if (!dog) return fail("NOT_FOUND", "반려견 프로필이 없습니다.");

  const practicePoint = await getPolicyNumber("point.practice");
  const db = getDb();

  const awardedPoints = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(lessonProgresses)
      .where(
        and(
          eq(lessonProgresses.dogId, dog.id),
          eq(lessonProgresses.lessonId, lessonId),
          eq(lessonProgresses.isDeleted, false),
        ),
      )
      .limit(1);

    const now = new Date();
    let shouldAward = false;

    if (!existing) {
      await tx.insert(lessonProgresses).values({
        dogId: dog.id,
        lessonId,
        practiceCompletedAt: now,
        practicePointAwarded: true,
        createdBy: session.userId,
      });
      shouldAward = true;
    } else {
      shouldAward = !existing.practicePointAwarded;
      await tx
        .update(lessonProgresses)
        .set({
          practiceCompletedAt: existing.practiceCompletedAt ?? now,
          practicePointAwarded: true,
          updatedBy: session.userId,
        })
        .where(eq(lessonProgresses.id, existing.id));
    }

    if (!shouldAward) return 0;

    const earned = await earnPointsTx(tx, {
      userId: session.userId,
      dogId: dog.id,
      amount: practicePoint,
      reason: "EARN_EDUCATION_PRACTICE",
      idempotencyKey: `lesson:${dog.id}:${lessonId}:practice`,
      refType: "lesson",
      refId: lessonId,
      memo: `레슨 #${lessonId} 실습 자가체크 완료`,
      enforceDailyEducationCap: true,
    });
    return earned.awardedAmount;
  });

  revalidatePath(`/app/lesson/${lessonId}`);
  revalidatePath("/app/wallet");
  return ok({ awardedPoints });
}

/** 3단계 최종 퀴즈 제출 (채점 + 포인트 + 레슨 완료 + 유닛/코스 완주 보너스 + 배지/학년 동기 갱신) */
export async function submitLessonQuizAction(input: {
  lessonId: number;
  selectedIndexes: number[];
}): Promise<
  ActionResult<{
    score: number;
    total: number;
    percent: number;
    passed: boolean;
    awardedPoints: number;
    bonusPoints: number;
    newBadges: string[];
  }>
> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const access = await checkLessonAccess(session.userId, input.lessonId);
  if (!access.ok) return access;

  const dog = await getPrimaryDog(session.userId);
  if (!dog) return fail("NOT_FOUND", "반려견 프로필이 없습니다.");

  const db = getDb();
  const [quizStep] = await db
    .select()
    .from(lessonSteps)
    .where(
      and(
        eq(lessonSteps.lessonId, input.lessonId),
        eq(lessonSteps.type, "QUIZ"),
        eq(lessonSteps.isDeleted, false),
      ),
    )
    .limit(1);
  if (!quizStep) return fail("NOT_FOUND", "퀴즈 단계를 찾을 수 없습니다.");

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.stepId, quizStep.id), eq(quizzes.isDeleted, false)))
    .limit(1);
  if (!quiz) return fail("NOT_FOUND", "퀴즈 정보를 찾을 수 없습니다.");

  const questions = await db
    .select()
    .from(quizQuestions)
    .where(and(eq(quizQuestions.quizId, quiz.id), eq(quizQuestions.isDeleted, false)))
    .orderBy(asc(quizQuestions.sortOrder));

  const [defaultPassPct, quizPoint, unitBonus, courseBonus, gradeTiers] = await Promise.all([
    getPolicyNumber("quiz.pass_percent"),
    getPolicyNumber("point.quiz"),
    getPolicyNumber("point.bonus.unit"),
    getPolicyNumber("point.bonus.course"),
    getGradeTiersPolicy(),
  ]);

  const passPct = quiz.passPercentOverride ?? defaultPassPct;
  const graded = gradeQuiz(
    input.selectedIndexes,
    questions.map((q) => q.answerIndex),
    passPct,
  );

  const txResult = await db.transaction(async (tx) => {
    await tx.insert(quizAttempts).values({
      quizId: quiz.id,
      dogId: dog.id,
      answers: questions.map((q, idx) => ({
        questionId: q.id,
        selectedIndex: input.selectedIndexes[idx] ?? -1,
      })),
      score: graded.score,
      total: graded.total,
      passed: graded.passed,
      createdBy: session.userId,
    });

    if (!graded.passed) {
      return { awardedPoints: 0, bonusPoints: 0, newBadges: [] as string[] };
    }

    const now = new Date();
    const [existing] = await tx
      .select()
      .from(lessonProgresses)
      .where(
        and(
          eq(lessonProgresses.dogId, dog.id),
          eq(lessonProgresses.lessonId, input.lessonId),
          eq(lessonProgresses.isDeleted, false),
        ),
      )
      .limit(1);

    let shouldAwardQuiz = false;
    if (!existing) {
      await tx.insert(lessonProgresses).values({
        dogId: dog.id,
        lessonId: input.lessonId,
        quizPassedAt: now,
        completedAt: now,
        quizPointAwarded: true,
        createdBy: session.userId,
      });
      shouldAwardQuiz = true;
    } else {
      shouldAwardQuiz = !existing.quizPointAwarded;
      await tx
        .update(lessonProgresses)
        .set({
          quizPassedAt: existing.quizPassedAt ?? now,
          completedAt: existing.completedAt ?? now,
          quizPointAwarded: true,
          updatedBy: session.userId,
        })
        .where(eq(lessonProgresses.id, existing.id));
    }

    let awardedPoints = 0;
    let bonusPoints = 0;
    const newBadges: string[] = [];

    if (shouldAwardQuiz) {
      const earned = await earnPointsTx(tx, {
        userId: session.userId,
        dogId: dog.id,
        amount: quizPoint,
        reason: "EARN_EDUCATION_QUIZ",
        idempotencyKey: `lesson:${dog.id}:${input.lessonId}:quiz`,
        refType: "lesson",
        refId: input.lessonId,
        memo: `레슨 #${input.lessonId} 퀴즈 통과`,
        enforceDailyEducationCap: true,
      });
      awardedPoints += earned.awardedAmount;
    }

    // 배지 부여 헬퍼
    const grantBadge = async (code: string) => {
      const [badge] = await tx
        .select()
        .from(badges)
        .where(and(eq(badges.code, code), eq(badges.isDeleted, false)))
        .limit(1);
      if (!badge) return;
      const [owned] = await tx
        .select()
        .from(dogBadges)
        .where(and(eq(dogBadges.dogId, dog.id), eq(dogBadges.badgeId, badge.id), eq(dogBadges.isDeleted, false)))
        .limit(1);
      if (!owned) {
        await tx.insert(dogBadges).values({
          dogId: dog.id,
          badgeId: badge.id,
          createdBy: session.userId,
        });
        newBadges.push(badge.name);
        await tx.insert(notifications).values({
          userId: session.userId,
          kind: "BADGE_EARNED",
          title: `새 배지 획득: ${badge.name}`,
          body: badge.description ?? "교육 달성으로 새로운 배지를 획득했어요.",
          deepLink: "/app/record?tab=badges",
        });
      }
    };

    await grantBadge("FIRST_LESSON");

    // 누적 완료 레슨 수 기반 배지(STREAK_5) & 학년 승급 평가 (강등 방지)
    const allCompletedForDog = await tx
      .select({ id: lessonProgresses.id })
      .from(lessonProgresses)
      .where(
        and(
          eq(lessonProgresses.dogId, dog.id),
          isNotNull(lessonProgresses.completedAt),
          eq(lessonProgresses.isDeleted, false),
        ),
      );
    const totalCompletedCount = allCompletedForDog.length;
    if (totalCompletedCount >= 5) {
      await grantBadge("STREAK_5");
    }
    const nextGrade = calcGradeFromLessonCount(totalCompletedCount, gradeTiers, dog.grade, true);
    if (nextGrade !== dog.grade) {
      await tx
        .update(dogs)
        .set({ grade: nextGrade, updatedBy: session.userId })
        .where(eq(dogs.id, dog.id));
    }

    // 유닛/코스 완주 평가
    const [lessonRow] = await tx.select().from(lessons).where(eq(lessons.id, input.lessonId)).limit(1);
    if (lessonRow) {
      const [unitRow] = await tx.select().from(units).where(eq(units.id, lessonRow.unitId)).limit(1);
      if (unitRow) {
        const unitLessons = await tx
          .select({ id: lessons.id })
          .from(lessons)
          .where(and(eq(lessons.unitId, unitRow.id), eq(lessons.isDeleted, false)));
        const doneUnit = await tx
          .select({ id: lessonProgresses.id })
          .from(lessonProgresses)
          .where(
            and(
              eq(lessonProgresses.dogId, dog.id),
              inArray(lessonProgresses.lessonId, unitLessons.map((l) => l.id)),
              isNotNull(lessonProgresses.completedAt),
              eq(lessonProgresses.isDeleted, false),
            ),
          );
        const completedCount = doneUnit.length;
        if (unitLessons.length > 0 && completedCount >= unitLessons.length) {
          const uEarned = await earnPointsTx(tx, {
            userId: session.userId,
            dogId: dog.id,
            amount: unitBonus,
            reason: "EARN_BONUS_UNIT",
            idempotencyKey: `unit:${dog.id}:${unitRow.id}:bonus`,
            refType: "unit",
            refId: unitRow.id,
            memo: `${unitRow.title} 유닛 완주 보너스`,
          });
          bonusPoints += uEarned.awardedAmount;
          await grantBadge("UNIT_MASTER");
        }

        // 코스 전체 완주 체크
        const courseUnits = await tx
          .select({ id: units.id })
          .from(units)
          .where(and(eq(units.courseId, unitRow.courseId), eq(units.isDeleted, false)));
        const allCourseLessons = await tx
          .select({ id: lessons.id })
          .from(lessons)
          .where(and(inArray(lessons.unitId, courseUnits.map((u) => u.id)), eq(lessons.isDeleted, false)));
        const doneCourseLessons = await tx
          .select({ lessonId: lessonProgresses.lessonId, completedAt: lessonProgresses.completedAt })
          .from(lessonProgresses)
          .where(
            and(
              eq(lessonProgresses.dogId, dog.id),
              inArray(lessonProgresses.lessonId, allCourseLessons.map((l) => l.id)),
              eq(lessonProgresses.isDeleted, false),
            ),
          );
        const actuallyDone = doneCourseLessons.filter((d) => d.completedAt !== null).length;

        if (allCourseLessons.length > 0 && actuallyDone >= allCourseLessons.length) {
          const [enr] = await tx
            .select()
            .from(enrollments)
            .where(
              and(
                eq(enrollments.dogId, dog.id),
                eq(enrollments.courseId, unitRow.courseId),
                eq(enrollments.isDeleted, false),
              ),
            )
            .limit(1);

          if (!enr) {
            await tx.insert(enrollments).values({
              dogId: dog.id,
              courseId: unitRow.courseId,
              status: "COMPLETED",
              completedAt: now,
              completionBonusAwarded: true,
              createdBy: session.userId,
            });
          } else if (enr.status !== "COMPLETED") {
            await tx
              .update(enrollments)
              .set({ status: "COMPLETED", completedAt: now, completionBonusAwarded: true })
              .where(eq(enrollments.id, enr.id));
          }

          const cEarned = await earnPointsTx(tx, {
            userId: session.userId,
            dogId: dog.id,
            amount: courseBonus,
            reason: "EARN_BONUS_COURSE",
            idempotencyKey: `course:${dog.id}:${unitRow.courseId}:bonus`,
            refType: "course",
            refId: unitRow.courseId,
            memo: `코스 #${unitRow.courseId} 완주 보너스`,
          });
          bonusPoints += cEarned.awardedAmount;

          // 코스 코드별 전용 완주 배지 분기 지급
          const [courseRow] = await tx
            .select({ code: courses.code })
            .from(courses)
            .where(eq(courses.id, unitRow.courseId))
            .limit(1);
          if (courseRow?.code === "PUPPY_BASIC_101") {
            await grantBadge("COURSE_PUPPY_BASIC");
          } else if (courseRow?.code === "WALK_MANNER_201") {
            await grantBadge("COURSE_WALK_MANNER");
          }
        }
      }
    }

    return { awardedPoints, bonusPoints, newBadges };
  });

  revalidatePath("/app");
  revalidatePath(`/app/lesson/${input.lessonId}`);
  revalidatePath("/app/record");
  revalidatePath("/app/wallet");
  return ok({ ...graded, ...txResult });
}
