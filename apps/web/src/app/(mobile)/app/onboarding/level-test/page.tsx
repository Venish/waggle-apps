import { and, asc, eq, getDb, levelTests } from "@repo/db";
import { requireUserSession } from "@/00_lib/session";
import { LevelTestClient } from "@/components/web/LevelTestClient";
import { EmptyStateCard, SubPageHeader } from "@/components/web/WebUiKit";

export const dynamic = "force-dynamic";

export default async function OnboardingLevelTestPage() {
  await requireUserSession();
  const db = getDb();
  const [lt] = await db
    .select()
    .from(levelTests)
    .where(and(eq(levelTests.isActive, true), eq(levelTests.isDeleted, false)))
    .orderBy(asc(levelTests.id))
    .limit(1);

  return (
    <div className="flex flex-1 flex-col space-y-4">
      <SubPageHeader title="선택 레벨테스트" backHref="/app/onboarding/result" />
      {lt ? (
        <LevelTestClient levelTestId={lt.id} title={lt.title} questions={lt.questions} />
      ) : (
        <EmptyStateCard
          title="준비된 레벨테스트가 없습니다"
          description="바로 데일리 목표를 설정하고 커리큘럼을 시작할 수 있어요."
          ctaLabel="목표 설정으로 이동"
          ctaHref="/app/onboarding/daily-goal"
        />
      )}
    </div>
  );
}
