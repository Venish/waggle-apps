import {
  and,
  asc,
  breeds,
  courses,
  courseUnlocks,
  dailyGoals,
  desc,
  dogs,
  enrollments,
  eq,
  getDb,
  gt,
  inArray,
  isNull,
  lessonProgresses,
  lessons,
  or,
  products,
  units,
  userTickets,
} from "@repo/db";
import { calcProgressPercent, computeLessonStates } from "@repo/types";
import { requireUserSession } from "@/00_lib/session";
import { getGradeTiersPolicy } from "@/04_services/shared/policyService";
import {
  EducationHomeClient,
  type EduCatalogCourseView,
  type EduDogOption,
  type EduEnrollmentView,
  type EducationMainTab,
} from "@/components/web/EducationHomeClient";
import { EmptyStateCard } from "@/components/web/WebUiKit";

export const dynamic = "force-dynamic";

function toKstYmd(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(date);
}

export default async function MobileEducationHomePage({
  searchParams,
}: {
  searchParams: Promise<{ dogId?: string; tab?: string; filter?: string }>;
}) {
  const session = await requireUserSession();
  const { dogId: queryDogId, tab: queryTab, filter: queryFilter } = await searchParams;
  const db = getDb();

  const [myDogs, goalRows, gradeTiers] = await Promise.all([
    db
      .select({
        id: dogs.id,
        name: dogs.name,
        isPrimary: dogs.isPrimary,
        grade: dogs.grade,
        birthDate: dogs.birthDate,
        profileImage: dogs.profileImage,
        breedName: breeds.nameKo,
      })
      .from(dogs)
      .leftJoin(breeds, eq(dogs.breedId, breeds.id))
      .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
      .orderBy(desc(dogs.isPrimary), asc(dogs.id)),
    db
      .select()
      .from(dailyGoals)
      .where(and(eq(dailyGoals.userId, session.userId), eq(dailyGoals.isDeleted, false)))
      .limit(1),
    getGradeTiersPolicy(),
  ]);

  if (myDogs.length === 0) {
    return (
      <EmptyStateCard
        mode="page"
        title="먼저 우리 강아지를 등록해 주세요"
        description="반려견 프로필을 등록하면 맞춤 교육 커리큘럼과 학습 경로가 열립니다."
        ctaLabel="반려견 프로필 등록"
        ctaHref="/app/onboarding/profile"
      />
    );
  }

  const primaryDog = myDogs.find((d) => d.isPrimary) ?? myDogs[0]!;
  const requestedDogId = queryDogId ? Number(queryDogId) : NaN;
  const initialDog = myDogs.find((d) => d.id === requestedDogId) ?? primaryDog;
  const initialTab: EducationMainTab = queryTab === "explore" ? "explore" : "my";
  const initialExploreFilter =
    queryFilter === "free" ? "FREE" : queryFilter === "premium" ? "PREMIUM" : "ALL";
  const dailyGoal = goalRows[0]?.dailyLessonGoal ?? 1;
  const allDogIds = myDogs.map((d) => d.id);
  const todayKst = toKstYmd(new Date());

  const now = new Date();
  const [
    allPublishedCourses,
    allUnits,
    allLessons,
    enrollmentRows,
    progressRows,
    unlockRows,
    availableCourseTickets,
    premiumProducts,
  ] = await Promise.all([
    db
      .select()
      .from(courses)
      .where(and(eq(courses.isPublished, true), eq(courses.isDeleted, false)))
      .orderBy(asc(courses.level), asc(courses.sortOrder), asc(courses.id)),
    db
      .select()
      .from(units)
      .where(eq(units.isDeleted, false))
      .orderBy(asc(units.sortOrder)),
    db
      .select()
      .from(lessons)
      .where(eq(lessons.isDeleted, false))
      .orderBy(asc(lessons.sortOrder)),
    db
      .select({
        dogId: enrollments.dogId,
        courseId: enrollments.courseId,
        status: enrollments.status,
        startedAt: enrollments.startedAt,
      })
      .from(enrollments)
      .where(and(inArray(enrollments.dogId, allDogIds), eq(enrollments.isDeleted, false))),
    db
      .select({
        dogId: lessonProgresses.dogId,
        lessonId: lessonProgresses.lessonId,
        completedAt: lessonProgresses.completedAt,
        updatedAt: lessonProgresses.updatedAt,
      })
      .from(lessonProgresses)
      .where(and(inArray(lessonProgresses.dogId, allDogIds), eq(lessonProgresses.isDeleted, false))),
    db
      .select({ courseId: courseUnlocks.courseId })
      .from(courseUnlocks)
      .where(and(eq(courseUnlocks.userId, session.userId), eq(courseUnlocks.isDeleted, false))),
    db
      .select({ id: userTickets.id, courseId: userTickets.courseId })
      .from(userTickets)
      .where(
        and(
          eq(userTickets.userId, session.userId),
          eq(userTickets.ticketType, "PREMIUM_UNLOCK"),
          eq(userTickets.status, "AVAILABLE"),
          eq(userTickets.isDeleted, false),
          or(isNull(userTickets.expiresAt), gt(userTickets.expiresAt, now)),
        ),
      )
      .orderBy(asc(userTickets.id)),
    db
      .select({ linkedCourseId: products.linkedCourseId, pointPrice: products.pointPrice })
      .from(products)
      .where(
        and(
          eq(products.type, "PREMIUM_UNLOCK"),
          eq(products.status, "ACTIVE"),
          eq(products.isDeleted, false),
        ),
      )
      .orderBy(asc(products.id)),
  ]);

  const unlockedSet = new Set(unlockRows.map((u) => u.courseId));
  const availableTicketIdByCourseId = new Map<number, number>();
  for (const t of availableCourseTickets) {
    if (t.courseId && !availableTicketIdByCourseId.has(t.courseId)) {
      availableTicketIdByCourseId.set(t.courseId, t.id);
    }
  }
  const pointPriceByCourseId = new Map<number, number>();
  for (const p of premiumProducts) {
    if (p.linkedCourseId && !pointPriceByCourseId.has(p.linkedCourseId)) {
      pointPriceByCourseId.set(p.linkedCourseId, p.pointPrice);
    }
  }
  const unitMap = new Map(allUnits.map((u) => [u.id, u]));
  const courseMap = new Map(allPublishedCourses.map((c) => [c.id, c]));

  // 코스별 정렬된 레슨 목록 사전 구성
  const courseLessonsMap = new Map<
    number,
    Array<{ lessonId: number; lessonTitle: string; unitTitle: string; unitOrder: number; lessonOrder: number }>
  >();
  for (const l of allLessons) {
    const u = unitMap.get(l.unitId);
    if (!u) continue;
    const arr = courseLessonsMap.get(u.courseId) ?? [];
    arr.push({
      lessonId: l.id,
      lessonTitle: l.title,
      unitTitle: u.title,
      unitOrder: u.sortOrder,
      lessonOrder: l.sortOrder,
    });
    courseLessonsMap.set(u.courseId, arr);
  }
  for (const arr of courseLessonsMap.values()) {
    arr.sort((a, b) => a.unitOrder - b.unitOrder || a.lessonOrder - b.lessonOrder);
  }

  // 반려견별 완료 레슨 Set, 최근 학습 시각 맵 & 오늘(KST) 완료 레슨 수 집계
  const completedSetByDog = new Map<number, Set<number>>();
  const lastActivityByDogLesson = new Map<string, string>();
  const completedTodayByDog: Record<number, number> = {};
  for (const dogId of allDogIds) {
    completedSetByDog.set(dogId, new Set());
    completedTodayByDog[dogId] = 0;
  }
  for (const p of progressRows) {
    const actIso = (p.completedAt ?? p.updatedAt).toISOString();
    const key = `${p.dogId}:${p.lessonId}`;
    const prev = lastActivityByDogLesson.get(key);
    if (!prev || actIso > prev) lastActivityByDogLesson.set(key, actIso);

    if (!p.completedAt) continue;
    completedSetByDog.get(p.dogId)?.add(p.lessonId);
    if (toKstYmd(p.completedAt) === todayKst) {
      completedTodayByDog[p.dogId] = (completedTodayByDog[p.dogId] ?? 0) + 1;
    }
  }

  // 반려견별 수강 코스 & 레슨 스텝 구성
  const enrollmentViews: EduEnrollmentView[] = [];
  for (const enr of enrollmentRows) {
    const course = courseMap.get(enr.courseId);
    if (!course) continue;
    const ordered = courseLessonsMap.get(course.id) ?? [];
    const doneSet = completedSetByDog.get(enr.dogId) ?? new Set<number>();
    const refs = ordered.map((item) => ({
      lessonId: item.lessonId,
      unitOrder: item.unitOrder,
      lessonOrder: item.lessonOrder,
    }));
    const stateMap = computeLessonStates(refs, doneSet);
    const courseUnlocked = !course.isPremium || unlockedSet.has(course.id);
    const steps = ordered.map((item) => ({
      lessonId: item.lessonId,
      lessonTitle: item.lessonTitle,
      unitTitle: item.unitTitle,
      status: courseUnlocked ? (stateMap.get(item.lessonId) ?? "available") : ("locked" as const),
    }));
    const doneCount = steps.filter((s) => s.status === "completed").length;

    let lastActivityAt: string | null = null;
    for (const item of ordered) {
      const act = lastActivityByDogLesson.get(`${enr.dogId}:${item.lessonId}`);
      if (act && (!lastActivityAt || act > lastActivityAt)) {
        lastActivityAt = act;
      }
    }

    enrollmentViews.push({
      dogId: enr.dogId,
      courseId: course.id,
      courseTitle: course.title,
      courseLevel: course.level,
      status: enr.status,
      progressPct: calcProgressPercent(steps.length, doneCount),
      doneLessons: doneCount,
      totalLessons: steps.length,
      startedAt: enr.startedAt.toISOString(),
      lastActivityAt,
      steps,
    });
  }

  // 전체 공개 교육 카탈로그
  const catalogCourses: EduCatalogCourseView[] = allPublishedCourses.map((c) => {
    const ordered = courseLessonsMap.get(c.id) ?? [];
    return {
      id: c.id,
      code: c.code,
      title: c.title,
      description: c.description,
      level: c.level,
      isPremium: c.isPremium,
      isUnlocked: !c.isPremium || unlockedSet.has(c.id),
      availableTicketId: availableTicketIdByCourseId.get(c.id) ?? null,
      pointPrice: pointPriceByCourseId.get(c.id) ?? null,
      lessonCount: ordered.length,
      lessonTitles: ordered.map((x) => x.lessonTitle),
    };
  });

  const dogOptions: EduDogOption[] = myDogs.map((d) => ({
    id: d.id,
    name: d.name,
    isPrimary: d.isPrimary,
    grade: d.grade,
    birthDate: d.birthDate,
    profileImage: d.profileImage,
    breedName: d.breedName,
  }));

  return (
    <EducationHomeClient
      dogs={dogOptions}
      initialDogId={initialDog.id}
      initialTab={initialTab}
      initialExploreFilter={initialExploreFilter}
      dailyGoal={dailyGoal}
      completedTodayByDog={completedTodayByDog}
      gradeTiers={gradeTiers}
      enrollments={enrollmentViews}
      catalogCourses={catalogCourses}
    />
  );
}
