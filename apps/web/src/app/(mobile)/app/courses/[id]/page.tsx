import { notFound } from "next/navigation";
import { ChevronRight, Lock } from "lucide-react";
import {
  and,
  asc,
  courses,
  courseUnlocks,
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
import { cn, PawIcon } from "@repo/ui";
import { requireUserSession } from "@/00_lib/session";
import { getWalletSummary } from "@/04_services/shared/pointLedgerService";
import { getRechargePackagesPolicy } from "@/04_services/shared/policyService";
import { EnrollCourseButton } from "@/components/web/EnrollCourseButton";
import {
  PremiumUnlockSheetTrigger,
  type PremiumUnlockSheetProps,
} from "@/components/web/PremiumCourseUnlockCard";
import { SubPageHeader } from "@/components/web/WebUiKit";
import { AppBadge, AppLink } from "@/components/web/ui";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dogId?: string }>;
}) {
  const session = await requireUserSession();
  const [{ id }, { dogId: queryDogId }] = await Promise.all([params, searchParams]);
  const courseId = Number(id);
  if (!Number.isInteger(courseId)) notFound();

  const db = getDb();
  const [course] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.isDeleted, false)))
    .limit(1);
  if (!course) notFound();

  const now = new Date();
  const [
    myDogs,
    unlockRows,
    courseUnits,
    wallet,
    rechargePackages,
    linkedProducts,
    availableTicketRows,
  ] = await Promise.all([
    db
      .select()
      .from(dogs)
      .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
      .orderBy(desc(dogs.isPrimary), asc(dogs.id)),
    db
      .select()
      .from(courseUnlocks)
      .where(
        and(
          eq(courseUnlocks.userId, session.userId),
          eq(courseUnlocks.courseId, course.id),
          eq(courseUnlocks.isDeleted, false),
        ),
      )
      .limit(1),
    db
      .select()
      .from(units)
      .where(and(eq(units.courseId, course.id), eq(units.isDeleted, false)))
      .orderBy(asc(units.sortOrder)),
    getWalletSummary(session.userId),
    course.isPremium ? getRechargePackagesPolicy() : Promise.resolve([]),
    course.isPremium
      ? db
          .select({ id: products.id, pointPrice: products.pointPrice })
          .from(products)
          .where(
            and(
              eq(products.linkedCourseId, course.id),
              eq(products.type, "PREMIUM_UNLOCK"),
              eq(products.status, "ACTIVE"),
              eq(products.isDeleted, false),
            ),
          )
          .orderBy(asc(products.id))
          .limit(1)
      : Promise.resolve([]),
    course.isPremium
      ? db
          .select({ id: userTickets.id, titleSnap: userTickets.titleSnap })
          .from(userTickets)
          .where(
            and(
              eq(userTickets.userId, session.userId),
              eq(userTickets.courseId, course.id),
              eq(userTickets.ticketType, "PREMIUM_UNLOCK"),
              eq(userTickets.status, "AVAILABLE"),
              eq(userTickets.isDeleted, false),
              or(isNull(userTickets.expiresAt), gt(userTickets.expiresAt, now)),
            ),
          )
          .orderBy(asc(userTickets.id))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const requestedDogId = queryDogId ? Number(queryDogId) : NaN;
  const primaryDog =
    myDogs.find((d) => d.id === requestedDogId) ?? myDogs.find((d) => d.isPrimary) ?? myDogs[0];
  const isUnlocked = !course.isPremium || Boolean(unlockRows[0]);
  const linkedProduct = linkedProducts[0] ?? null;
  const availableTicket = availableTicketRows[0]
    ? { id: availableTicketRows[0].id, title: availableTicketRows[0].titleSnap }
    : null;

  const allLessons =
    courseUnits.length > 0
      ? await db
          .select()
          .from(lessons)
          .where(
            and(
              inArray(
                lessons.unitId,
                courseUnits.map((u) => u.id),
              ),
              eq(lessons.isDeleted, false),
            ),
          )
          .orderBy(asc(lessons.sortOrder))
      : [];

  const [enrollmentRows, progressRows] = primaryDog
    ? await Promise.all([
        db
          .select()
          .from(enrollments)
          .where(
            and(
              eq(enrollments.dogId, primaryDog.id),
              eq(enrollments.courseId, course.id),
              eq(enrollments.isDeleted, false),
            ),
          )
          .limit(1),
        allLessons.length > 0
          ? db
              .select()
              .from(lessonProgresses)
              .where(
                and(
                  eq(lessonProgresses.dogId, primaryDog.id),
                  inArray(
                    lessonProgresses.lessonId,
                    allLessons.map((l) => l.id),
                  ),
                  eq(lessonProgresses.isDeleted, false),
                ),
              )
          : Promise.resolve([]),
      ])
    : [[], []];

  const completedSet = new Set(
    progressRows.filter((p) => p.completedAt !== null).map((p) => p.lessonId),
  );
  const unitOrderMap = new Map(courseUnits.map((u) => [u.id, u.sortOrder]));
  const stateMap = computeLessonStates(
    allLessons.map((l) => ({
      lessonId: l.id,
      unitOrder: unitOrderMap.get(l.unitId) ?? 0,
      lessonOrder: l.sortOrder,
    })),
    completedSet,
  );
  const pct = calcProgressPercent(allLessons.length, completedSet.size);

  const unlockSheetProps: PremiumUnlockSheetProps = {
    courseId: course.id,
    courseTitle: course.title,
    dogId: primaryDog?.id,
    dogName: primaryDog?.name,
    pointPrice: linkedProduct?.pointPrice ?? null,
    productId: linkedProduct?.id ?? null,
    walletBalance: wallet.balance,
    rechargePackages,
    availableTicket,
  };

  return (
    <div className="space-y-6">
      <SubPageHeader title="강좌 상세" backHref="/app" />

      <section className="space-y-4 rounded-3xl bg-surface-subtle p-5">
        <div className="flex items-center justify-between gap-2">
          <AppBadge tone={course.isPremium ? "brand" : "neutral"} size="md">
            Lv.{course.level} · {course.isPremium ? "프리미엄" : "무료"}
          </AppBadge>
          <span className="text-xs font-bold tabular-nums text-brand-strong">{pct}% 완료</span>
        </div>

        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">{course.title}</h2>
          {course.description && (
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{course.description}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="waggle-progress-flow h-full rounded-full transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          {isUnlocked && enrollmentRows[0] && (
            <p className="text-xs font-medium tabular-nums text-ink-muted">
              <strong className="font-bold text-ink">{primaryDog?.name}</strong> 수강 중 ·{" "}
              {completedSet.size} / {allLessons.length} 강의 완료
            </p>
          )}
        </div>

        {!isUnlocked ? (
          <PremiumUnlockSheetTrigger props={unlockSheetProps} />
        ) : !enrollmentRows[0] ? (
          <EnrollCourseButton
            courseId={course.id}
            label="내 강좌에 담고 시작하기"
            redirectTo={`/app/courses/${course.id}`}
          />
        ) : null}
      </section>

      <div className="space-y-6">
        {(() => {
          const showChapterHeaders = courseUnits.length > 1;
          let globalLessonIndex = 0;
          return courseUnits.map((unit) => {
            const unitLessons = allLessons.filter((l) => l.unitId === unit.id);
            const chapterTitle = unit.title.replace(/^Unit\s*/i, "챕터 ");
            return (
              <section key={unit.id}>
                {showChapterHeaders && (
                  <h3 className="mb-2 text-xs font-bold tracking-tight text-ink-muted">
                    {chapterTitle}
                  </h3>
                )}
                <ul className="divide-y divide-border-subtle border-y border-border-subtle">
                  {unitLessons.map((lesson) => {
                    globalLessonIndex += 1;
                    const lessonNumber = globalLessonIndex;
                    const status = isUnlocked ? (stateMap.get(lesson.id) ?? "available") : "locked";
                    const isDone = status === "completed";
                    const isCurrent = status === "current";
                    const isPaywallLocked = !isUnlocked;
                    const content = (
                      <div className="flex items-center justify-between gap-3 py-3.5 transition-opacity active:opacity-65">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "flex size-7 shrink-0 items-center justify-center rounded-full",
                              isDone
                                ? "bg-brand text-white"
                                : isCurrent
                                  ? "bg-brand-soft text-brand-strong"
                                  : "bg-surface-subtle text-ink-muted",
                            )}
                          >
                            {isDone ? (
                              <PawIcon className="size-4" />
                            ) : isPaywallLocked ? (
                              <Lock className="size-3.5" strokeWidth={2} />
                            ) : (
                              <span
                                className={cn(
                                  "text-xs tabular-nums",
                                  isCurrent ? "font-extrabold" : "font-bold",
                                )}
                              >
                                {lessonNumber}
                              </span>
                            )}
                          </span>
                          <div className="min-w-0">
                            <p
                              className={cn(
                                "truncate text-sm",
                                isCurrent
                                  ? "font-bold text-ink"
                                  : isDone
                                    ? "font-semibold text-ink"
                                    : isPaywallLocked
                                      ? "font-medium text-ink-muted"
                                      : "font-semibold text-ink",
                              )}
                            >
                              {lesson.title}
                            </p>
                            {lesson.summary && (
                              <p className="mt-0.5 truncate text-xs text-ink-muted">
                                {lesson.summary}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-strong">
                              <span
                                aria-hidden="true"
                                className="size-1.5 rounded-full bg-brand"
                              />
                              다음
                            </span>
                          )}
                          {isDone && (
                            <span className="text-xs font-semibold text-ink-muted">완료</span>
                          )}
                          <ChevronRight className="size-4 text-ink-muted" strokeWidth={1.8} />
                        </div>
                      </div>
                    );

                    return (
                      <li key={lesson.id}>
                        {isPaywallLocked ? (
                          <PremiumUnlockSheetTrigger props={unlockSheetProps}>
                            {content}
                          </PremiumUnlockSheetTrigger>
                        ) : (
                          <AppLink href={`/app/lesson/${lesson.id}`} className="block">
                            {content}
                          </AppLink>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          });
        })()}
      </div>
    </div>
  );
}
