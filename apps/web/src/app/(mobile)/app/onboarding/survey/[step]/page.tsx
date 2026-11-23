import { redirect } from "next/navigation";
import { and, asc, eq, getDb, surveyAnswers, surveyQuestions } from "@repo/db";
import { requireUserSession } from "@/00_lib/session";
import { SurveyStepClient } from "@/components/web/SurveyStepClient";

export const dynamic = "force-dynamic";

export default async function OnboardingSurveyStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  await requireUserSession();
  const { step: rawStep } = await params;
  const stepNum = Number(rawStep);

  const db = getDb();
  const questions = await db
    .select()
    .from(surveyQuestions)
    .where(and(eq(surveyQuestions.isActive, true), eq(surveyQuestions.isDeleted, false)))
    .orderBy(asc(surveyQuestions.sortOrder));

  if (!Number.isInteger(stepNum) || stepNum < 1 || stepNum > questions.length) {
    redirect("/app/onboarding/survey/1");
  }

  const current = questions[stepNum - 1]!;
  const answers = await db
    .select({ id: surveyAnswers.id, text: surveyAnswers.text })
    .from(surveyAnswers)
    .where(
      and(
        eq(surveyAnswers.questionId, current.id),
        eq(surveyAnswers.isActive, true),
        eq(surveyAnswers.isDeleted, false),
      ),
    )
    .orderBy(asc(surveyAnswers.sortOrder));

  return (
    <SurveyStepClient
      step={stepNum}
      totalSteps={questions.length}
      questionId={current.id}
      questionText={current.text}
      allowMultiple={current.allowMultiple}
      options={answers}
    />
  );
}
