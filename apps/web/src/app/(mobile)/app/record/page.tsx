import {
  and,
  asc,
  badges,
  breeds,
  courses,
  desc,
  dogBadges,
  dogs,
  enrollments,
  eq,
  getDb,
  inArray,
  lessonProgresses,
  lessons,
  lessonSteps,
  quizAttempts,
  quizzes,
  units,
} from "@repo/db";
import { requireUserSession } from "@/00_lib/session";
import { getGradeTiersPolicy } from "@/04_services/shared/policyService";
import {
  RecordHubClient,
  type RecordCompletedLessonItem,
  type RecordCourseCatalogBrief,
  type RecordCourseProgressItem,
  type RecordDogOption,
  type RecordMainTab,
  type RecordUnitStat,
} from "@/components/web/RecordHubClient";
import { EmptyStateCard } from "@/components/web/WebUiKit";

export const dynamic = "force-dynamic";

function toKstYmd(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(date);
}

export default async function RecordHubPage({
  searchParams,
}: {
  searchParams: Promise<{ dogId?: string; tab?: string }>;
}) {
  const session = await requireUserSession();
  const { dogId: queryDogId, tab: queryTab } = await searchParams;
  const db = getDb();

  const myDogs = await db
    .select({
      id: dogs.id,
      name: dogs.name,
      isPrimary: dogs.isPrimary,
      grade: dogs.grade,
      profileImage: dogs.profileImage,
      breedName: breeds.nameKo,
    })
    .from(dogs)
    .leftJoin(breeds, eq(dogs.breedId, breeds.id))
    .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
    .orderBy(desc(dogs.isPrimary), asc(dogs.id));

  if (myDogs.length === 0) {
    return (
      <EmptyStateCard
        mode="page"
        title="등록된 반려견이 없어요"
        description="반려견 프로필을 등록하면 교육 기록과 배지가 쌓입니다."
        ctaLabel="반려견 등록하기"
        ctaHref="/app/onboarding/profile"
      />
    );
  }

  const primaryDog = myDogs.find((d) => d.isPrimary) ?? myDogs[0]!;
  const requestedDogId = queryDogId ? Number(queryDogId) : NaN;
  const initialDog = myDogs.find((d) => d.id === requestedDogId) ?? primaryDog;
  const initialTab: RecordMainTab = queryTab === "badges" || queryTab === "grade" ? "badges" : "growth";

  const allDogIds = myDogs.map((d) => d.id);
  const todayStr = toKstYmd(new Date());

  const [
    gradeTiers,
    enrollmentRows,
    allCourses,
    allUnits,
    allLessons,
    progressRows,
    quizAttemptRows,
    allBadges,
    earnedBadgeRows,
  ] = await Promise.all([
    getGradeTiersPolicy(),
    db
      .select({
        dogId: enrollments.dogId,
        courseId: enrollments.courseId,
        status: enrollments.status,
        completedAt: enrollments.completedAt,
      })
      .from(enrollments)
      .where(and(inArray(enrollments.dogId, allDogIds), eq(enrollments.isDeleted, false))),
    db
      .select({
        id: courses.id,
        code: courses.code,
        title: courses.title,
        level: courses.level,
      })
      .from(courses)
      .where(eq(courses.isDeleted, false))
      .orderBy(asc(courses.level), asc(courses.sortOrder), asc(courses.id)),
    db
      .select({
        id: units.id,
        courseId: units.courseId,
        title: units.title,
      })
      .from(units)
      .where(eq(units.isDeleted, false)),
    db
      .select({
        id: lessons.id,
        unitId: lessons.unitId,
        title: lessons.title,
      })
      .from(lessons)
      .where(eq(lessons.isDeleted, false)),
    db
      .select({
        id: lessonProgresses.id,
        dogId: lessonProgresses.dogId,
        lessonId: lessonProgresses.lessonId,
        completedAt: lessonProgresses.completedAt,
        completedVia: lessonProgresses.completedVia,
      })
      .from(lessonProgresses)
      .where(and(inArray(lessonProgresses.dogId, allDogIds), eq(lessonProgresses.isDeleted, false))),
    db
      .select({
        dogId: quizAttempts.dogId,
        lessonId: lessonSteps.lessonId,
        score: quizAttempts.score,
        total: quizAttempts.total,
        passed: quizAttempts.passed,
        createdAt: quizAttempts.createdAt,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .innerJoin(lessonSteps, eq(quizzes.stepId, lessonSteps.id))
      .where(inArray(quizAttempts.dogId, allDogIds))
      .orderBy(desc(quizAttempts.createdAt)),
    db
      .select({
        id: badges.id,
        code: badges.code,
        kind: badges.kind,
        name: badges.name,
        iconName: badges.iconName,
        description: badges.description,
      })
      .from(badges)
      .where(eq(badges.isDeleted, false))
      .orderBy(asc(badges.id)),
    db
      .select({
        dogId: dogBadges.dogId,
        badgeId: dogBadges.badgeId,
        earnedAt: dogBadges.earnedAt,
      })
      .from(dogBadges)
      .where(and(inArray(dogBadges.dogId, allDogIds), eq(dogBadges.isDeleted, false))),
  ]);

  // 코스 / 유닛 / 레슨 메타 맵 구성
  const courseMap = new Map(allCourses.map((c) => [c.id, c]));
  const unitMap = new Map(allUnits.map((u) => [u.id, u]));
  const lessonMap = new Map(allLessons.map((l) => [l.id, l]));

  const lessonCountByCourse = new Map<number, number>();
  const lessonCountByUnit = new Map<number, number>();
  const lessonsByCourse = new Map<number, number[]>();
  for (const l of allLessons) {
    lessonCountByUnit.set(l.unitId, (lessonCountByUnit.get(l.unitId) ?? 0) + 1);
    const unit = unitMap.get(l.unitId);
    if (!unit) continue;
    lessonCountByCourse.set(unit.courseId, (lessonCountByCourse.get(unit.courseId) ?? 0) + 1);
    const arr = lessonsByCourse.get(unit.courseId) ?? [];
    arr.push(l.id);
    lessonsByCourse.set(unit.courseId, arr);
  }

  // 반려견별 완료 레슨 Set + 퀴즈 최고(합격 우선) 점수 맵
  const completedSetByDog = new Map<number, Set<number>>();
  const activityDateSetByDog = new Map<number, Set<string>>();
  for (const dogId of allDogIds) {
    completedSetByDog.set(dogId, new Set());
    activityDateSetByDog.set(dogId, new Set());
  }

  const bestQuizByDogLesson = new Map<string, { score: number; total: number; passed: boolean }>();
  for (const qa of quizAttemptRows) {
    activityDateSetByDog.get(qa.dogId)?.add(toKstYmd(qa.createdAt));
    const key = `${qa.dogId}:${qa.lessonId}`;
    const prev = bestQuizByDogLesson.get(key);
    if (!prev || (!prev.passed && qa.passed) || (prev.passed === qa.passed && qa.score > prev.score)) {
      bestQuizByDogLesson.set(key, { score: qa.score, total: qa.total, passed: qa.passed });
    }
  }

  const completedLessons: RecordCompletedLessonItem[] = [];
  for (const p of progressRows) {
    if (!p.completedAt) continue;
    completedSetByDog.get(p.dogId)?.add(p.lessonId);
    const dateKst = toKstYmd(p.completedAt);
    activityDateSetByDog.get(p.dogId)?.add(dateKst);

    const lesson = lessonMap.get(p.lessonId);
    if (!lesson) continue;
    const unit = unitMap.get(lesson.unitId);
    const course = unit ? courseMap.get(unit.courseId) : undefined;
    const quizBest = bestQuizByDogLesson.get(`${p.dogId}:${p.lessonId}`);

    completedLessons.push({
      id: p.id,
      dogId: p.dogId,
      lessonId: p.lessonId,
      lessonTitle: lesson.title,
      courseId: course?.id ?? 0,
      courseTitle: course?.title ?? "교육 코스",
      unitTitle: unit?.title ?? "",
      completedAt: p.completedAt.toISOString(),
      completedDateKst: dateKst,
      completedVia: p.completedVia,
      quizScore: quizBest?.score ?? null,
      quizTotal: quizBest?.total ?? null,
    });
  }

  // 반려견별 수강 코스 진도율
  const courseProgresses: RecordCourseProgressItem[] = [];
  for (const enr of enrollmentRows) {
    const course = courseMap.get(enr.courseId);
    if (!course) continue;
    const courseLessonIds = lessonsByCourse.get(course.id) ?? [];
    const doneSet = completedSetByDog.get(enr.dogId) ?? new Set<number>();
    const doneCount = courseLessonIds.filter((lid) => doneSet.has(lid)).length;
    courseProgresses.push({
      dogId: enr.dogId,
      courseId: course.id,
      courseCode: course.code,
      courseTitle: course.title,
      courseLevel: course.level,
      status: enr.status,
      totalLessons: courseLessonIds.length,
      completedLessons: doneCount,
      completedAt: enr.completedAt ? enr.completedAt.toISOString() : null,
    });
  }

  // 반려견별 유닛 진도 통계 (UNIT_MASTER 배지 진행률 산출용)
  const unitStats: RecordUnitStat[] = [];
  for (const dogId of allDogIds) {
    const doneSet = completedSetByDog.get(dogId) ?? new Set<number>();
    for (const unit of allUnits) {
      const total = lessonCountByUnit.get(unit.id) ?? 0;
      if (total === 0) continue;
      let done = 0;
      for (const l of allLessons) {
        if (l.unitId === unit.id && doneSet.has(l.id)) done += 1;
      }
      unitStats.push({ dogId, unitId: unit.id, totalLessons: total, completedLessons: done });
    }
  }

  const courseCatalog: RecordCourseCatalogBrief[] = allCourses.map((c) => ({
    courseId: c.id,
    courseCode: c.code,
    courseTitle: c.title,
    courseLevel: c.level,
    totalLessons: lessonCountByCourse.get(c.id) ?? 0,
  }));

  const activityDatesByDog: Record<number, string[]> = {};
  for (const [dogId, set] of activityDateSetByDog.entries()) {
    activityDatesByDog[dogId] = Array.from(set);
  }

  const dogOptions: RecordDogOption[] = myDogs.map((d) => ({
    id: d.id,
    name: d.name,
    isPrimary: d.isPrimary,
    grade: d.grade,
    profileImage: d.profileImage,
    breedName: d.breedName,
  }));

  return (
    <RecordHubClient
      dogs={dogOptions}
      initialDogId={initialDog.id}
      initialTab={initialTab}
      todayStr={todayStr}
      gradeTiers={gradeTiers}
      courseProgresses={courseProgresses}
      completedLessons={completedLessons}
      activityDatesByDog={activityDatesByDog}
      unitStats={unitStats}
      courseCatalog={courseCatalog}
      allBadges={allBadges}
      earnedBadges={earnedBadgeRows.map((eb) => ({
        dogId: eb.dogId,
        badgeId: eb.badgeId,
        earnedAt: eb.earnedAt.toISOString(),
      }))}
    />
  );
}
