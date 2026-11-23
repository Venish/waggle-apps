import Link from "next/link";
import { asc, eq, getDb, surveyAnswers, surveyQuestions } from "@repo/db";
import { requireAdminSession } from "@/00_lib/session";
import { adminCreateSurveyQuestionAction } from "@/03_actions/admin/adminEducationMatchingActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminMatchingSurveyPage() {
  await requireAdminSession(["ADMIN"]);
  const db = getDb();

  const [questions, answers] = await Promise.all([
    db.select().from(surveyQuestions).where(eq(surveyQuestions.isDeleted, false)).orderBy(asc(surveyQuestions.sortOrder)),
    db.select().from(surveyAnswers).where(eq(surveyAnswers.isDeleted, false)).orderBy(asc(surveyAnswers.sortOrder)),
  ]);

  async function addQuestion(formData: FormData) {
    "use server";
    const rawAnswers = String(formData.get("answers") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return adminCreateSurveyQuestionAction({
      code: String(formData.get("code") ?? ""),
      text: String(formData.get("text") ?? ""),
      allowMultiple: formData.get("allowMultiple") === "on",
      initialAnswers: rawAnswers,
    });
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="온보딩 설문 문항 · 선택지 관리"
        actions={
          <Link href="/admin/matching" className="inline-flex h-7 items-center rounded-control px-2.5 text-control atlas-border">
            매칭 개요
          </Link>
        }
      />

      <AdminActionForm
        action={addQuestion}
        errorTitle="설문 문항 추가 실패"
        successMessage="설문 문항이 추가되었습니다."
        resetOnSuccess
        className="grid gap-2 rounded-panel bg-base-2 p-4 sm:grid-cols-4 atlas-border"
      >
        <input name="code" placeholder="문항 코드 (Q8_...)" className="h-7 rounded-control bg-base-1 px-2.5 font-mono text-xs atlas-border" />
        <input name="text" placeholder="질문 텍스트" className="h-7 sm:col-span-2 rounded-control bg-base-1 px-2.5 text-xs atlas-border" />
        <input name="answers" placeholder="선택지 (쉼표 구분)" className="h-7 rounded-control bg-base-1 px-2.5 text-xs atlas-border" />
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" name="allowMultiple" /> 복수 선택 허용
        </label>
        <button type="submit" className="h-7 rounded-control bg-inverse px-3 text-control font-medium text-on-inverse">
          문항 추가
        </button>
      </AdminActionForm>

      <div className="space-y-2.5">
        {questions.map((q) => (
          <div key={q.id} className="rounded-panel bg-base-1 p-4 atlas-border">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                Q{q.sortOrder}. [{q.code}] {q.text}
              </p>
              <AdminStatusBadge tone={q.allowMultiple ? "info" : "neutral"}>
                {q.allowMultiple ? "복수 선택" : "단일 선택"}
              </AdminStatusBadge>
            </div>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {answers
                .filter((a) => a.questionId === q.id)
                .map((a) => (
                  <li key={a.id} className="rounded-badge bg-base-2 px-2 py-1 text-xs text-secondary atlas-border">
                    {a.text}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
