import { redirect } from "next/navigation";
import { and, dogs, eq, getDb } from "@repo/db";
import { getCurrentUserSession } from "@/00_lib/session";

export const dynamic = "force-dynamic";

export default async function OnboardingRouterPage() {
  const session = await getCurrentUserSession();
  if (!session) redirect("/app/onboarding/intro");
  if (session.onboardingCompleted) redirect("/app");

  const db = getDb();
  const [dog] = await db
    .select({ id: dogs.id })
    .from(dogs)
    .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
    .limit(1);

  if (!dog) redirect("/app/onboarding/profile");
  redirect("/app/onboarding/survey");
}
