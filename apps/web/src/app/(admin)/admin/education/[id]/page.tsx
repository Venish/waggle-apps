import { notFound } from "next/navigation";
import { and, asc, courses, eq, getDb, inArray, lessons, lessonSteps, units } from "@repo/db";
import { requireAdminSession } from "@/00_lib/session";
import {
  adminAddUnitAndLessonAction,
  adminSoftDeleteCourseAction,
  adminUpdateLessonVideoAction,
  adminUpsertCourseAction,
} from "@/03_actions/admin/adminEducationMatchingActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminUiKit";
import { AdminVideoSourceField } from "@/components/admin/AdminVideoSourceField";

export const dynamic = "force-dynamic";

export default async function AdminEducationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession(["ADMIN"]);
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isInteger(courseId)) notFound();

  const db = getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) notFound();

  const courseUnits = await db
    .select()
    .from(units)
    .where(and(eq(units.courseId, course.id), eq(units.isDeleted, false)))
    .orderBy(asc(units.sortOrder));

  const unitLessons =
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

  const videoSteps =
    unitLessons.length > 0
      ? await db
          .select({
            lessonId: lessonSteps.lessonId,
            youtubeVideoId: lessonSteps.youtubeVideoId,
            videoUrl: lessonSteps.videoUrl,
          })
          .from(lessonSteps)
          .where(
            and(
              inArray(
                lessonSteps.lessonId,
                unitLessons.map((l) => l.id),
              ),
              eq(lessonSteps.type, "VIDEO"),
              eq(lessonSteps.isDeleted, false),
            ),
          )
      : [];

  const videoStepByLessonId = new Map(videoSteps.map((s) => [s.lessonId, s]));

  async function updateCourse(formData: FormData) {
    "use server";
    return adminUpsertCourseAction({
      id: courseId,
      code: String(formData.get("code") ?? course!.code),
      title: String(formData.get("title") ?? course!.title),
      description: String(formData.get("description") ?? ""),
      level: Number(formData.get("level") ?? course!.level),
      isPremium: formData.get("isPremium") === "on",
      isPublished: formData.get("isPublished") === "on",
      sortOrder: course!.sortOrder,
    });
  }

  async function addUnitLesson(formData: FormData) {
    "use server";
    return adminAddUnitAndLessonAction({
      courseId,
      unitTitle: String(formData.get("unitTitle") ?? ""),
      lessonTitle: String(formData.get("lessonTitle") ?? ""),
      youtubeVideoId: String(formData.get("youtubeVideoId") ?? ""),
      videoUrl: String(formData.get("videoUrl") ?? ""),
      checklistText: String(formData.get("checklistText") ?? ""),
      quizQuestionText: String(formData.get("quizQuestionText") ?? ""),
    });
  }

  async function deleteCourse() {
    "use server";
    return adminSoftDeleteCourseAction(courseId);
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title={`강좌 관리: ${course.title}`}
        description={`코드: ${course.code} · Level ${course.level}`}
        actions={
          <AdminActionForm
            action={deleteCourse}
            errorTitle="참조 데이터 삭제 차단"
            successMessage="강좌가 소프트 삭제되었습니다."
            redirectTo="/admin/education"
          >
            <button
              type="submit"
              className="h-7 whitespace-nowrap rounded-control px-2.5 text-control text-negative atlas-border"
            >
              강좌 삭제 (수강 이력 시 차단)
            </button>
          </AdminActionForm>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminActionForm
          action={updateCourse}
          errorTitle="강좌 저장 실패"
          successMessage="강좌 기본 정보가 저장되었습니다."
          className="space-y-3 rounded-panel bg-base-2 p-4 atlas-border"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">강좌 기본 정보</h3>
            <AdminStatusBadge tone={course.isPublished ? "positive" : "neutral"}>
              {course.isPublished ? "게시중" : "비공개"}
            </AdminStatusBadge>
          </div>
          <input
            name="code"
            defaultValue={course.code}
            className="h-7 w-full rounded-control bg-base-1 px-2.5 font-mono text-xs atlas-border"
          />
          <input
            name="title"
            defaultValue={course.title}
            className="h-7 w-full rounded-control bg-base-1 px-2.5 text-sm atlas-border"
          />
          <textarea
            name="description"
            defaultValue={course.description ?? ""}
            rows={2}
            className="w-full rounded-control bg-base-1 p-2 text-xs atlas-border"
          />
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1">
              레벨{" "}
              <input
                name="level"
                type="number"
                min={1}
                max={5}
                defaultValue={course.level}
                className="h-6 w-12 rounded-btn-sm bg-base-1 px-1.5 font-mono atlas-border"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="isPremium" defaultChecked={course.isPremium} /> 프리미엄
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="isPublished" defaultChecked={course.isPublished} /> 게시
            </label>
          </div>
          <button
            type="submit"
            className="h-7 rounded-control bg-inverse px-3 text-control font-medium text-on-inverse"
          >
            기본 정보 저장
          </button>
        </AdminActionForm>

        <AdminActionForm
          action={addUnitLesson}
          errorTitle="챕터·강의 추가 실패"
          successMessage="새 챕터와 3단계 강의가 추가되었습니다."
          resetOnSuccess
          className="space-y-2.5 rounded-panel bg-base-2 p-4 atlas-border"
        >
          <h3 className="text-sm font-semibold">새 챕터 + 3단계 강의 빠른 추가</h3>
          <input
            name="unitTitle"
            placeholder="챕터 제목 (예: 챕터 3. 실전 응용)"
            className="h-7 w-full rounded-control bg-base-1 px-2.5 text-xs atlas-border"
          />
          <input
            name="lessonTitle"
            placeholder="강의 제목"
            className="h-7 w-full rounded-control bg-base-1 px-2.5 text-xs atlas-border"
          />
          <AdminVideoSourceField
            uploadCategory="lessons"
            youtubeIdName="youtubeVideoId"
            videoUrlName="videoUrl"
            initialYoutubeId="M7lc1UVf-VE"
            label="강의 교육 영상 (YouTube 또는 직접 업로드)"
          />
          <input
            name="checklistText"
            placeholder="실습 체크리스트 항목"
            className="h-7 w-full rounded-control bg-base-1 px-2.5 text-xs atlas-border"
          />
          <input
            name="quizQuestionText"
            placeholder="퀴즈 1번 문항"
            className="h-7 w-full rounded-control bg-base-1 px-2.5 text-xs atlas-border"
          />
          <button
            type="submit"
            className="h-7 rounded-control bg-inverse px-3 text-control font-medium text-on-inverse"
          >
            챕터·강의 세트 추가
          </button>
        </AdminActionForm>
      </div>

      <section className="space-y-3 rounded-panel bg-base-1 p-4 atlas-border">
        <h3 className="text-sm font-semibold">
          강좌 목차 ({courseUnits.length} 챕터 · {unitLessons.length} 강의)
        </h3>
        {courseUnits.map((u) => (
          <div key={u.id} className="space-y-2 rounded-control bg-base-2 p-3 atlas-border">
            <p className="text-xs font-semibold text-neutral">
              #{u.sortOrder} {u.title}
            </p>
            <ul className="space-y-2 pl-2 text-xs text-secondary">
              {unitLessons
                .filter((l) => l.unitId === u.id)
                .map((l) => {
                  const vStep = videoStepByLessonId.get(l.id);
                  const hasUpload = Boolean(vStep?.videoUrl);
                  const hasYoutube = Boolean(vStep?.youtubeVideoId);

                  async function updateLessonVideo(formData: FormData) {
                    "use server";
                    return adminUpdateLessonVideoAction({
                      courseId,
                      lessonId: l.id,
                      youtubeVideoId: String(formData.get("youtubeVideoId") ?? ""),
                      videoUrl: String(formData.get("videoUrl") ?? ""),
                    });
                  }

                  return (
                    <li
                      key={l.id}
                      className="rounded-btn-sm bg-base-1 p-2.5 atlas-border"
                    >
                      <details>
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                          <span className="font-medium text-neutral">
                            [{l.sortOrder}] {l.title}{" "}
                            <span className="font-mono text-subdued">(ID: #{l.id})</span>
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <AdminStatusBadge
                              tone={hasUpload ? "info" : hasYoutube ? "positive" : "neutral"}
                            >
                              {hasUpload ? "업로드 영상" : hasYoutube ? "YouTube" : "영상 미등록"}
                            </AdminStatusBadge>
                            <span className="text-xs text-info">영상 설정</span>
                          </div>
                        </summary>

                        <div className="mt-3 pt-2.5 atlas-border-t">
                          <AdminActionForm
                            action={updateLessonVideo}
                            errorTitle="강의 영상 저장 실패"
                            successMessage="강의 교육 영상이 변경되었습니다."
                            className="space-y-2.5"
                          >
                            <AdminVideoSourceField
                              uploadCategory="lessons"
                              youtubeIdName="youtubeVideoId"
                              videoUrlName="videoUrl"
                              initialYoutubeId={vStep?.youtubeVideoId ?? null}
                              initialVideoUrl={vStep?.videoUrl ?? null}
                              label={`#${l.id} ${l.title} 영상 설정`}
                            />
                            <button
                              type="submit"
                              className="h-7 rounded-control bg-inverse px-3 text-control font-medium text-on-inverse"
                            >
                              영상 변경 저장
                            </button>
                          </AdminActionForm>
                        </div>
                      </details>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
