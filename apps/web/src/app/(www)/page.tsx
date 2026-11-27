import { and, asc, courses, eq, getDb, inArray, lessons, units } from "@repo/db";
import { WwwAppDownloadSection } from "./_components/WwwAppDownloadSection";
import { WwwCorePillarsSection } from "./_components/WwwCorePillarsSection";
import { WwwCoursesSection, type WwwCourseItem } from "./_components/WwwCoursesSection";
import { WwwFaqSection } from "./_components/WwwFaqSection";
import { WwwFooter } from "./_components/WwwFooter";
import { WwwHeader } from "./_components/WwwHeader";
import { WwwHeroSection } from "./_components/WwwHeroSection";
import { WwwScrollProvider } from "./_components/WwwScrollProvider";
import { WwwSelfCheckSection } from "./_components/WwwSelfCheckSection";

export const dynamic = "force-dynamic";

const FALLBACK_COURSES: WwwCourseItem[] = [
  {
    id: 1,
    title: "기초 생활 매너 완성",
    description:
      "이름 부르기, 앉아·기다려, 하우스 적응까지 반려견과 함께 살아가는 가장 기본적인 약속을 매일 5분으로 완성합니다.",
    level: 1,
    isPremium: false,
    lessonCount: 6,
  },
  {
    id: 2,
    title: "당기지 않는 여유로운 산책",
    description:
      "리드줄 당김, 다른 강아지 흥분 짖음을 단계별 역조건화 실습으로 차분하게 교정하는 산책 매너 과정입니다.",
    level: 2,
    isPremium: false,
    lessonCount: 5,
  },
  {
    id: 3,
    title: "아파트 짖음 & 분리불안 집중 케어",
    description:
      "현관 벨소리 반응과 외출 시 불안 짖음을 원인별로 진단하고, 매일 5분 둔감화 루틴으로 안정감을 키워줍니다.",
    level: 3,
    isPremium: true,
    lessonCount: 8,
  },
];

async function getPublishedCourses(): Promise<WwwCourseItem[]> {
  try {
    const db = getDb();
    const courseRows = await db
      .select({
        id: courses.id,
        title: courses.title,
        description: courses.description,
        level: courses.level,
        isPremium: courses.isPremium,
      })
      .from(courses)
      .where(and(eq(courses.isPublished, true), eq(courses.isDeleted, false)))
      .orderBy(asc(courses.sortOrder), asc(courses.id))
      .limit(6);

    if (courseRows.length === 0) {
      return FALLBACK_COURSES;
    }

    const courseIds = courseRows.map((c) => c.id);
    const unitRows = await db
      .select({ id: units.id, courseId: units.courseId })
      .from(units)
      .where(and(inArray(units.courseId, courseIds), eq(units.isDeleted, false)));

    const unitToCourse = new Map<number, number>();
    unitRows.forEach((u) => unitToCourse.set(u.id, u.courseId));

    const lessonCountByCourse = new Map<number, number>();
    if (unitRows.length > 0) {
      const lessonRows = await db
        .select({ id: lessons.id, unitId: lessons.unitId })
        .from(lessons)
        .where(
          and(
            inArray(
              lessons.unitId,
              unitRows.map((u) => u.id),
            ),
            eq(lessons.isDeleted, false),
          ),
        );

      lessonRows.forEach((l) => {
        const cId = unitToCourse.get(l.unitId);
        if (cId !== undefined) {
          lessonCountByCourse.set(cId, (lessonCountByCourse.get(cId) ?? 0) + 1);
        }
      });
    }

    return courseRows.map((row) => ({
      ...row,
      lessonCount: lessonCountByCourse.get(row.id) ?? 0,
    }));
  } catch {
    return FALLBACK_COURSES;
  }
}

export default async function WwwLandingPage() {
  const publishedCourses = await getPublishedCourses();

  return (
    <WwwScrollProvider>
      <div className="min-h-dvh bg-canvas text-ink">
        <WwwHeader />
        <main>
          <WwwHeroSection />
          <WwwSelfCheckSection />
          <WwwCorePillarsSection />
          <WwwCoursesSection courses={publishedCourses} />
          <WwwFaqSection />
          <WwwAppDownloadSection />
        </main>
        <WwwFooter />
      </div>
    </WwwScrollProvider>
  );
}
