"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  accounts,
  and,
  dailyGoals,
  eq,
  getDb,
  pointWallets,
  users,
} from "@repo/db";
import { fail, ok, type ActionResult } from "@repo/types";
import { resolveUserNickname } from "@/00_lib/nickname";
import { hashPassword, verifyPassword } from "@/00_lib/password";
import {
  createUserSession,
  getCurrentUserSession,
  resolveUserPostAuthPath,
  revokeAllUserSessions,
} from "@/00_lib/session";
import { getUserSessionPolicy } from "@/00_lib/userSessionConfig";

const loginSchema = z.object({
  email: z.string().email("올바른 이메일 주소를 입력해 주세요."),
  password: z.string().min(6, "비밀번호는 6자 이상 입력해 주세요."),
});

const optionalNicknameSchema = z
  .string()
  .trim()
  .max(30, "닉네임은 30자 이하로 입력해 주세요.")
  .refine((v) => v === "" || v.length >= 2, "닉네임은 2자 이상 입력해 주세요.")
  .optional()
  .default("");

const signupSchema = z.object({
  email: z.string().email("올바른 이메일 주소를 입력해 주세요."),
  password: z.string().min(8, "비밀번호는 8자 이상 입력해 주세요."),
  nickname: optionalNicknameSchema,
  phone: z.string().optional(),
  marketingOptIn: z.boolean().default(false),
});

export async function userLoginAction(
  input: z.infer<typeof loginSchema>,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
  }

  const db = getDb();
  const policy = getUserSessionPolicy();
  const email = parsed.data.email.trim().toLowerCase();

  const rows = await db
    .select({
      accountId: accounts.id,
      passwordHash: accounts.passwordHash,
      failedLoginCount: accounts.failedLoginCount,
      userId: users.id,
      userStatus: users.status,
      termsAgreedAt: users.termsAgreedAt,
      onboardingCompletedAt: users.onboardingCompletedAt,
    })
    .from(accounts)
    .innerJoin(users, eq(users.accountId, accounts.id))
    .where(
      and(
        eq(accounts.provider, "EMAIL"),
        eq(accounts.providerId, email),
        eq(accounts.isDeleted, false),
        eq(users.isDeleted, false),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row || !row.passwordHash) {
    return fail("UNAUTHORIZED", "이메일 또는 비밀번호가 올바르지 않습니다.");
  }
  if (row.userStatus !== "ACTIVE") {
    return fail("FORBIDDEN", "정지되었거나 탈퇴된 계정입니다. 고객센터에 문의해 주세요.");
  }
  if (row.failedLoginCount >= policy.maxLoginAttempts) {
    return fail("FORBIDDEN", "비밀번호 5회 이상 오답으로 계정이 잠겼습니다.");
  }

  const valid = verifyPassword(parsed.data.password, row.passwordHash);
  if (!valid) {
    await db
      .update(accounts)
      .set({ failedLoginCount: row.failedLoginCount + 1 })
      .where(eq(accounts.id, row.accountId));
    return fail("UNAUTHORIZED", "이메일 또는 비밀번호가 올바르지 않습니다.");
  }

  await db
    .update(accounts)
    .set({ failedLoginCount: 0 })
    .where(eq(accounts.id, row.accountId));

  await createUserSession(row.userId);
  return ok({
    redirectTo: resolveUserPostAuthPath({
      termsAgreedAt: row.termsAgreedAt,
      onboardingCompletedAt: row.onboardingCompletedAt,
    }),
  });
}

export async function userSignupAction(
  input: z.infer<typeof signupSchema>,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
  }

  const db = getDb();
  const email = parsed.data.email.trim().toLowerCase();

  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.provider, "EMAIL"),
        eq(accounts.providerId, email),
        eq(accounts.isDeleted, false),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return fail("CONFLICT", "이미 가입된 이메일 주소입니다.");
  }

  const userId = await db.transaction(async (tx) => {
    const [acc] = await tx
      .insert(accounts)
      .values({
        provider: "EMAIL",
        providerId: email,
        email,
        emailVerifiedAt: new Date(),
        passwordHash: hashPassword(parsed.data.password),
      })
      .returning();

    const [user] = await tx
      .insert(users)
      .values({
        accountId: acc!.id,
        nickname: resolveUserNickname(parsed.data.nickname),
        phone: parsed.data.phone?.trim() || null,
        marketingOptIn: parsed.data.marketingOptIn,
        status: "ACTIVE",
      })
      .returning();

    await tx.insert(pointWallets).values({ userId: user!.id, balance: 0, createdBy: user!.id });
    await tx.insert(dailyGoals).values({
      userId: user!.id,
      dailyLessonGoal: 1,
      reminderEnabled: true,
      reminderTime: "20:00",
      createdBy: user!.id,
    });

    return user!.id;
  });

  await createUserSession(userId);
  return ok({ redirectTo: "/app/onboarding/extra" });
}

const onboardingExtraSchema = z.object({
  nickname: optionalNicknameSchema,
  phone: z.string().max(30, "연락처는 30자 이하로 입력해 주세요.").optional(),
  agreedTerms: z.literal(true, {
    message: "필수 이용약관에 동의해 주세요.",
  }),
  marketingOptIn: z.boolean().default(false),
});

export async function completeOnboardingExtraAction(
  input: z.infer<typeof onboardingExtraSchema>,
): Promise<ActionResult<{ redirectTo: string }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = onboardingExtraSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
  }

  const finalNickname = resolveUserNickname(parsed.data.nickname);
  const db = getDb();
  await db
    .update(users)
    .set({
      nickname: finalNickname,
      phone: parsed.data.phone?.trim() || null,
      marketingOptIn: parsed.data.marketingOptIn,
      termsAgreedAt: new Date(),
      updatedBy: session.userId,
    })
    .where(eq(users.id, session.userId));

  revalidatePath("/app");
  revalidatePath("/app/my");
  revalidatePath("/app/my/settings");
  return ok({ redirectTo: "/app/onboarding/profile" });
}

export async function userLogoutAction(): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentUserSession();
  if (session) {
    await revokeAllUserSessions(session.userId, "LOGOUT");
  }
  const policy = getUserSessionPolicy();
  const cookieStore = await cookies();
  cookieStore.set(policy.cookieName, "", { path: policy.cookiePath, maxAge: 0 });
  return ok({ ok: true });
}

const updateSettingsSchema = z.object({
  nickname: optionalNicknameSchema,
  region: z.string().max(100).optional(),
  pushOptIn: z.boolean(),
  educationPushOptIn: z.boolean(),
  marketingOptIn: z.boolean(),
});

export async function updateUserSettingsAction(
  input: z.infer<typeof updateSettingsSchema>,
): Promise<ActionResult<{ updated: true; nickname: string }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = updateSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
  }

  const finalNickname = resolveUserNickname(parsed.data.nickname);
  const db = getDb();
  await db
    .update(users)
    .set({
      nickname: finalNickname,
      region: parsed.data.region?.trim() || null,
      pushOptIn: parsed.data.pushOptIn,
      educationPushOptIn: parsed.data.educationPushOptIn,
      marketingOptIn: parsed.data.marketingOptIn,
      updatedBy: session.userId,
    })
    .where(eq(users.id, session.userId));

  revalidatePath("/app");
  revalidatePath("/app/my");
  revalidatePath("/app/my/settings");
  return ok({ updated: true, nickname: finalNickname });
}

const changePwSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8, "새 비밀번호는 8자 이상 입력해 주세요."),
});

export async function changeUserPasswordAction(
  input: z.infer<typeof changePwSchema>,
): Promise<ActionResult<{ changed: true }>> {
  const session = await getCurrentUserSession();
  if (!session) return fail("UNAUTHORIZED", "로그인이 필요합니다.");

  const parsed = changePwSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "비밀번호를 확인해 주세요.");
  }

  const db = getDb();
  const [acc] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, session.accountId), eq(accounts.isDeleted, false)))
    .limit(1);

  if (!acc || !acc.passwordHash) {
    return fail("VALIDATION_ERROR", "소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.");
  }
  if (!verifyPassword(parsed.data.currentPassword, acc.passwordHash)) {
    return fail("UNAUTHORIZED", "현재 비밀번호가 일치하지 않습니다.");
  }

  await db
    .update(accounts)
    .set({ passwordHash: hashPassword(parsed.data.newPassword), updatedBy: session.userId })
    .where(eq(accounts.id, acc.id));

  // 보안 정책: 비밀번호 변경 시 기존 세션 전체 폐기 후 현재 기기 신규 세션 발급
  await revokeAllUserSessions(session.userId, "SECURITY_RESET");
  await createUserSession(session.userId);
  return ok({ changed: true });
}
