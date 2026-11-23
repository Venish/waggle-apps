import {
  and,
  answerTags,
  asc,
  courses,
  courseTags,
  dogs,
  eq,
  getDb,
  inArray,
  surveyResponses,
  tags,
} from "@repo/db";
import { calcAgeTag, scoreCourses, type WeightedTag } from "@repo/types";
import { WaggleMark } from "@repo/ui";
import { requireUserSession } from "@/00_lib/session";
import { EnrollCourseButton } from "@/components/web/EnrollCourseButton";
import { AppBadge, AppLinkButton } from "@/components/web/ui";

export const dynamic = "force-dynamic";

export default async function OnboardingResultPage() {
  const session = await requireUserSession();
  const db = getDb();

  const myDogs = await db
    .select()
    .from(dogs)
    .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
    .orderBy(asc(dogs.id));
  const primaryDog = myDogs.find((d) => d.isPrimary) ?? myDogs[0];

  const dogWeightedTags: WeightedTag[] = [];
  if (primaryDog) {
    const ageCode = calcAgeTag(new Date(primaryDog.birthDate));
    dogWeightedTags.push({ code: ageCode, weight: 2 });

    const responses = await db
      .select({ answerId: surveyResponses.answerId })
      .from(surveyResponses)
      .where(and(eq(surveyResponses.dogId, primaryDog.id), eq(surveyResponses.isDeleted, false)));

    if (responses.length > 0) {
      const aTags = await db
        .select({ code: tags.code, weight: answerTags.weight })
        .from(answerTags)
        .innerJoin(tags, eq(answerTags.tagId, tags.id))
        .where(
          and(
            inArray(answerTags.answerId, responses.map((r) => r.answerId)),
            eq(answerTags.isDeleted, false),
          ),
        );
      dogWeightedTags.push(...aTags);
    }
  }

  const [freePublishedCourses, allCourseTags, allTags] = await Promise.all([
    db
      .select()
      .from(courses)
      .where(
        and(
          eq(courses.isPublished, true),
          eq(courses.isPremium, false),
          eq(courses.isDeleted, false),
        ),
      )
      .orderBy(asc(courses.sortOrder)),
    db
      .select({ courseId: courseTags.courseId, code: tags.code, weight: courseTags.weight })
      .from(courseTags)
      .innerJoin(tags, eq(courseTags.tagId, tags.id))
      .where(eq(courseTags.isDeleted, false)),
    db.select({ code: tags.code, name: tags.name }).from(tags).where(eq(tags.isDeleted, false)),
  ]);

  const tagNameMap = new Map(allTags.map((t) => [t.code, t.name]));

  const matchScores = scoreCourses(
    dogWeightedTags,
    freePublishedCourses.map((c) => ({
      courseId: c.id,
      tags: allCourseTags
        .filter((ct) => ct.courseId === c.id)
        .map((ct) => ({ code: ct.code, weight: ct.weight })),
    })),
  );

  const rankedCourses =
    matchScores.length > 0
      ? matchScores
          .map((ms) => ({
            course: freePublishedCourses.find((c) => c.id === ms.courseId)!,
            score: ms.score,
            matchedTags: ms.matchedTags,
          }))
          .filter((item) => Boolean(item.course))
          .sort((a, b) => b.score - a.score)
      : freePublishedCourses.map((course) => ({ course, score: 1, matchedTags: [] as string[] }));

  return (
    <div className="space-y-6 py-2">
      <section className="space-y-3 border-b border-border-subtle pb-5">
        <span className="waggle-squircle inline-flex size-10 items-center justify-center bg-brand text-white">
          <WaggleMark className="w-[56%]" />
        </span>
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink">
          {primaryDog ? `${primaryDog.name}에게 꼭 맞는` : "우리 강아지 맞춤"}
          <br />
          추천 강좌예요
        </h1>
      </section>

      <ul className="divide-y divide-border-subtle border-b border-border-subtle">
        {rankedCourses.map((item, idx) => (
          <li key={item.course.id} className="space-y-3 py-5 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <AppBadge tone="brand" className="tabular-nums">
                  추천 {idx + 1}위
                </AppBadge>
                <span className="text-xs font-semibold tabular-nums text-ink-muted">
                  매칭 {item.score}점
                </span>
              </div>
              <span className="text-xs font-bold tabular-nums text-ink">
                Lv.{item.course.level}
              </span>
            </div>

            <div>
              <h2 className="text-base font-bold text-ink">{item.course.title}</h2>
              {item.course.description && (
                <p className="mt-1 text-sm leading-relaxed text-ink">
                  {item.course.description}
                </p>
              )}
            </div>

            {item.matchedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.matchedTags.map((code) => (
                  <AppBadge key={code} tone="neutral">
                    #{tagNameMap.get(code) ?? code}
                  </AppBadge>
                ))}
              </div>
            )}

            <EnrollCourseButton courseId={item.course.id} label="이 강좌로 시작하기" />
          </li>
        ))}
      </ul>

      <div className="space-y-2.5 pt-1">
        <AppLinkButton href="/app/onboarding/level-test" variant="secondary" size="lg" fullWidth>
          레벨테스트 해보기
        </AppLinkButton>
        <AppLinkButton href="/app/onboarding/daily-goal" variant="ghost" size="md" fullWidth>
          건너뛰고 목표 설정
        </AppLinkButton>
      </div>
    </div>
  );
}
