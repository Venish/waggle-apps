import { NextResponse, type NextRequest } from "next/server";
import {
  accounts,
  and,
  dailyGoals,
  eq,
  getDb,
  pointWallets,
  users,
} from "@repo/db";
import { resolveUserNickname } from "@/00_lib/nickname";
import { createUserSession, resolveUserPostAuthPath } from "@/00_lib/session";

const ALLOWED_PROVIDERS = {
  kakao: "KAKAO",
  apple: "APPLE",
  naver: "NAVER",
  google: "GOOGLE",
} as const;

type ProviderSlug = keyof typeof ALLOWED_PROVIDERS;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: rawProvider } = await context.params;
  const slug = rawProvider.toLowerCase() as ProviderSlug;
  if (!(slug in ALLOWED_PROVIDERS)) {
    return NextResponse.json({ ok: false, error: "Unsupported provider" }, { status: 400 });
  }

  const provider = ALLOWED_PROVIDERS[slug];
  const mockSub = request.nextUrl.searchParams.get("mockSub") ?? `mock_${slug}_demo_user`;
  const email = `${slug}.demo@waggle.kr`;
  const nickname = resolveUserNickname(request.nextUrl.searchParams.get("nickname"));

  const db = getDb();
  const existing = await db
    .select({
      userId: users.id,
      termsAgreedAt: users.termsAgreedAt,
      onboardingCompletedAt: users.onboardingCompletedAt,
    })
    .from(accounts)
    .innerJoin(users, eq(users.accountId, accounts.id))
    .where(
      and(
        eq(accounts.provider, provider),
        eq(accounts.providerId, mockSub),
        eq(accounts.isDeleted, false),
        eq(users.isDeleted, false),
      ),
    )
    .limit(1);

  let userId = existing[0]?.userId;
  let termsAgreedAt: Date | null = existing[0]?.termsAgreedAt ?? null;
  let onboardingCompletedAt: Date | null = existing[0]?.onboardingCompletedAt ?? null;

  if (!userId) {
    const created = await db.transaction(async (tx) => {
      const [acc] = await tx
        .insert(accounts)
        .values({
          provider,
          providerId: mockSub,
          email,
          emailVerifiedAt: new Date(),
        })
        .returning();

      const [u] = await tx
        .insert(users)
        .values({
          accountId: acc!.id,
          nickname,
          status: "ACTIVE",
        })
        .returning();

      await tx.insert(pointWallets).values({ userId: u!.id, balance: 0, createdBy: u!.id });
      await tx.insert(dailyGoals).values({
        userId: u!.id,
        dailyLessonGoal: 1,
        reminderEnabled: true,
        reminderTime: "20:00",
        createdBy: u!.id,
      });

      return u!;
    });
    userId = created.id;
    termsAgreedAt = null;
    onboardingCompletedAt = null;
  }

  await createUserSession(userId);
  const dest = resolveUserPostAuthPath({ termsAgreedAt, onboardingCompletedAt });
  return NextResponse.redirect(new URL(dest, request.url));
}
