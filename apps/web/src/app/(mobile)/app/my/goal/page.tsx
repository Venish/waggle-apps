import { and, dailyGoals, eq, getDb } from "@repo/db";
import { requireUserSession } from "@/00_lib/session";
import { DailyGoalFormClient } from "@/components/web/DailyGoalFormClient";
import { SubPageHeader } from "@/components/web/WebUiKit";

export const dynamic = "force-dynamic";

export default async function MyGoalPage() {
  const session = await requireUserSession();
  const db = getDb();
  const [goal] = await db
    .select()
    .from(dailyGoals)
    .where(and(eq(dailyGoals.userId, session.userId), eq(dailyGoals.isDeleted, false)))
    .limit(1);

  return (
    <div className="space-y-4">
      <SubPageHeader title="데일리 목표 수정" backHref="/app/my" />
      <DailyGoalFormClient
        initialGoal={goal?.dailyLessonGoal ?? 1}
        initialEnabled={goal?.reminderEnabled ?? true}
        initialTime={goal?.reminderTime ?? "20:00"}
        initialDays={goal?.reminderDays ?? [0, 1, 2, 3, 4, 5, 6]}
        redirectTo="/app/my"
      />
    </div>
  );
}
