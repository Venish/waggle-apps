"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  adminOtpCodes,
  admins,
  adminSessions,
  and,
  eq,
  getDb,
  isNull,
} from "@repo/db";
import { fail, ok, type ActionResult } from "@repo/types";
import { sendSmsOtpAdapter } from "@/00_lib/adapters";
import { getAdminSessionPolicy } from "@/00_lib/adminSessionConfig";
import {
  generateNumericOtp,
  generateRandomToken,
  hashPassword,
  sha256Hex,
  verifyPassword,
} from "@/00_lib/password";
import { createAdminSession, getCurrentAdminSession } from "@/00_lib/session";
import { recordAuditLog } from "@/04_services/shared/auditService";

const step1Schema = z.object({
  email: z.string().email("올바른 관리자 이메일을 입력해 주세요."),
  password: z.string().min(6, "비밀번호를 입력해 주세요."),
});

export async function adminLoginStep1Action(
  input: z.infer<typeof step1Schema>,
): Promise<ActionResult<{ otpRequired: true; maskedPhone: string; devMockOtp?: string }>> {
  const parsed = step1Schema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
  }

  const db = getDb();
  const policy = getAdminSessionPolicy();
  const email = parsed.data.email.trim().toLowerCase();

  const [admin] = await db
    .select()
    .from(admins)
    .where(and(eq(admins.email, email), eq(admins.isDeleted, false)))
    .limit(1);

  if (!admin) {
    return fail("UNAUTHORIZED", "이메일 또는 비밀번호가 일치하지 않습니다.");
  }
  if (admin.status === "LOCKED" || admin.failedLoginCount >= policy.maxLoginAttempts) {
    return fail("FORBIDDEN", "비밀번호/OTP 5회 오답으로 계정이 잠겼습니다. 상위 관리자에게 잠금 해제를 요청하세요.");
  }
  if (admin.status !== "ACTIVE") {
    return fail("FORBIDDEN", "비활성화되었거나 정지된 관리자 계정입니다.");
  }

  if (!verifyPassword(parsed.data.password, admin.passwordHash)) {
    const nextFail = admin.failedLoginCount + 1;
    const isNowLocked = nextFail >= policy.maxLoginAttempts;
    await db
      .update(admins)
      .set({
        failedLoginCount: nextFail,
        status: isNowLocked ? "LOCKED" : admin.status,
        lockedAt: isNowLocked ? new Date() : null,
      })
      .where(eq(admins.id, admin.id));

    return fail(
      isNowLocked ? "FORBIDDEN" : "UNAUTHORIZED",
      isNowLocked
        ? "5회 오답으로 계정이 잠겼습니다."
        : `비밀번호가 올바르지 않습니다. (${nextFail}/${policy.maxLoginAttempts})`,
    );
  }

  // 2단계 SMS OTP 발급
  const otpCode = generateNumericOtp(6);
  const challengeToken = generateRandomToken(32);
  const expiresAt = new Date(Date.now() + policy.otpExpiresMs);
  const smsResult = await sendSmsOtpAdapter(admin.phone, otpCode);

  await db.insert(adminOtpCodes).values({
    adminId: admin.id,
    challengeTokenHash: sha256Hex(challengeToken),
    codeHash: sha256Hex(otpCode),
    devPlainCode: smsResult.mocked ? otpCode : null,
    expiresAt,
    createdBy: admin.id,
  });

  const cookieStore = await cookies();
  cookieStore.set(policy.otpCookieName, challengeToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: policy.cookiePath,
    maxAge: Math.floor(policy.otpExpiresMs / 1000),
  });

  const maskedPhone = admin.phone.replace(/(\d{3})-?(\d{3,4})-?(\d{4})/, "$1-****-$3");
  return ok({
    otpRequired: true,
    maskedPhone,
    devMockOtp: smsResult.mocked ? otpCode : undefined,
  });
}

export async function adminLoginStep2VerifyOtpAction(
  otpCode: string,
): Promise<ActionResult<{ redirectTo: string }>> {
  const code = otpCode.trim();
  if (!/^\d{6}$/.test(code)) {
    return fail("VALIDATION_ERROR", "6자리 숫자 인증번호를 입력해 주세요.");
  }

  const policy = getAdminSessionPolicy();
  const cookieStore = await cookies();
  const challengeToken = cookieStore.get(policy.otpCookieName)?.value;
  if (!challengeToken) {
    return fail("UNAUTHORIZED", "인증 세션이 만료되었습니다. 처음부터 다시 로그인해 주세요.");
  }

  const db = getDb();
  const [otpRow] = await db
    .select()
    .from(adminOtpCodes)
    .where(
      and(
        eq(adminOtpCodes.challengeTokenHash, sha256Hex(challengeToken)),
        isNull(adminOtpCodes.consumedAt),
        eq(adminOtpCodes.isDeleted, false),
      ),
    )
    .limit(1);

  if (!otpRow || otpRow.expiresAt.getTime() < Date.now()) {
    return fail("UNAUTHORIZED", "인증번호가 만료되었습니다. 다시 로그인해 주세요.");
  }

  const [admin] = await db
    .select()
    .from(admins)
    .where(and(eq(admins.id, otpRow.adminId), eq(admins.isDeleted, false)))
    .limit(1);
  if (!admin || admin.status !== "ACTIVE") {
    return fail("FORBIDDEN", "접근이 제한된 계정입니다.");
  }

  if (otpRow.codeHash !== sha256Hex(code)) {
    const nextFail = admin.failedLoginCount + 1;
    const locked = nextFail >= policy.maxLoginAttempts;
    await db
      .update(admins)
      .set({
        failedLoginCount: nextFail,
        status: locked ? "LOCKED" : admin.status,
        lockedAt: locked ? new Date() : null,
      })
      .where(eq(admins.id, admin.id));

    return fail(
      locked ? "FORBIDDEN" : "UNAUTHORIZED",
      locked
        ? "5회 오답으로 계정이 잠겼습니다."
        : `인증번호가 일치하지 않습니다. (${nextFail}/${policy.maxLoginAttempts})`,
    );
  }

  await db
    .update(adminOtpCodes)
    .set({ consumedAt: new Date(), updatedBy: admin.id })
    .where(eq(adminOtpCodes.id, otpRow.id));

  cookieStore.set(policy.otpCookieName, "", { path: policy.cookiePath, maxAge: 0 });
  await createAdminSession(admin.id);

  await recordAuditLog({
    actorType: "ADMIN",
    actorId: admin.id,
    action: "admin.login",
    entity: "admins",
    entityId: admin.id,
  });

  return ok({ redirectTo: admin.role === "TRAINER" ? "/admin/trainer" : "/admin/dashboard" });
}

export async function adminLogoutAction(): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (session) {
    const db = getDb();
    await db
      .update(adminSessions)
      .set({ revokedAt: new Date(), revokedReason: "LOGOUT" })
      .where(and(eq(adminSessions.adminId, session.adminId), isNull(adminSessions.revokedAt)));
  }
  const policy = getAdminSessionPolicy();
  const cookieStore = await cookies();
  cookieStore.set(policy.sessionCookieName, "", { path: policy.cookiePath, maxAge: 0 });
  cookieStore.set(policy.otpCookieName, "", { path: policy.cookiePath, maxAge: 0 });
  return ok({ ok: true });
}

const createAdminSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(60),
  phone: z.string().min(8).max(30),
  role: z.enum(["ADMIN", "TRAINER"]),
  password: z.string().min(8),
});

export async function createAdminAccountAction(
  input: z.infer<typeof createAdminSchema>,
): Promise<ActionResult<{ id: number }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "운영자 권한이 필요합니다.");

  const parsed = createAdminSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", "관리자 정보를 정확히 입력해 주세요.");

  const db = getDb();
  const email = parsed.data.email.trim().toLowerCase();
  const [dup] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(and(eq(admins.email, email), eq(admins.isDeleted, false)))
    .limit(1);
  if (dup) return fail("CONFLICT", "이미 등록된 관리자 이메일입니다.");

  const [created] = await db
    .insert(admins)
    .values({
      email,
      name: parsed.data.name.trim(),
      phone: parsed.data.phone.trim(),
      role: parsed.data.role,
      passwordHash: hashPassword(parsed.data.password),
      status: "ACTIVE",
      createdBy: session.adminId,
    })
    .returning();

  await recordAuditLog({
    actorId: session.adminId,
    action: "admin.create",
    entity: "admins",
    entityId: created!.id,
    afterData: { email, name: parsed.data.name, role: parsed.data.role },
  });

  revalidatePath("/admin/admins");
  return ok({ id: created!.id });
}

export async function updateAdminStatusAction(input: {
  adminId: number;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  unlock?: boolean;
}): Promise<ActionResult<{ ok: true }>> {
  const session = await getCurrentAdminSession();
  if (!session || session.role !== "ADMIN") return fail("FORBIDDEN", "운영자 권한이 필요합니다.");

  const db = getDb();
  await db
    .update(admins)
    .set({
      status: input.status,
      failedLoginCount: input.unlock ? 0 : undefined,
      lockedAt: input.unlock ? null : undefined,
      updatedBy: session.adminId,
    })
    .where(eq(admins.id, input.adminId));

  if (input.status !== "ACTIVE") {
    await db
      .update(adminSessions)
      .set({ revokedAt: new Date(), revokedReason: "SECURITY_RESET" })
      .where(and(eq(adminSessions.adminId, input.adminId), isNull(adminSessions.revokedAt)));
  }

  await recordAuditLog({
    actorId: session.adminId,
    action: "admin.status_update",
    entity: "admins",
    entityId: input.adminId,
    afterData: input,
  });

  revalidatePath("/admin/admins");
  revalidatePath(`/admin/admins/${input.adminId}`);
  return ok({ ok: true });
}
