import { redirect } from "next/navigation";
import { eq, getDb, users } from "@repo/db";
import { requireUserSession } from "@/00_lib/session";
import { OnboardingExtraClient } from "@/components/web/OnboardingExtraClient";

export const dynamic = "force-dynamic";

export default async function OnboardingExtraPage() {
  const session = await requireUserSession({ allowUnagreedTerms: true });
  if (session.termsAgreed) {
    redirect(session.onboardingCompleted ? "/app" : "/app/onboarding/profile");
  }

  const db = getDb();
  const [user] = await db
    .select({ nickname: users.nickname, phone: users.phone })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  const isAutoNick = Boolean(user?.nickname?.startsWith("waggle_"));

  return (
    <OnboardingExtraClient
      initialNickname={isAutoNick ? "" : (user?.nickname ?? "")}
      initialPhone={user?.phone ?? ""}
    />
  );
}
