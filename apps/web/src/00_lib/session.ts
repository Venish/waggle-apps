import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  adminSessions,
  admins,
  and,
  authSessions,
  eq,
  getDb,
  isNull,
  users,
} from "@repo/db";
import type { AdminRole } from "@repo/types";
import { getAdminSessionPolicy } from "./adminSessionConfig";
import { generateRandomToken, sha256Hex } from "./password";
import { getUserSessionPolicy } from "./userSessionConfig";

export interface AuthenticatedUser {
  sessionId: number;
  userId: number;
  accountId: number;
  nickname: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  termsAgreed: boolean;
  onboardingCompleted: boolean;
}

export function resolveUserPostAuthPath(state: {
  termsAgreedAt: Date | null;
  onboardingCompletedAt: Date | null;
}): string {
  if (!state.termsAgreedAt) return "/app/onboarding/extra";
  if (!state.onboardingCompletedAt) return "/app/onboarding/profile";
  return "/app";
}

export interface AuthenticatedAdmin {
  sessionId: number;
  adminId: number;
  email: string;
  name: string;
  role: AdminRole;
}

export type UserSessionCheckResult =
  | { status: "AUTHENTICATED"; user: AuthenticatedUser }
  | { status: "UNAUTHENTICATED" }
  | { status: "REVOKED"; reason: string };

export const checkCurrentUserSession = cache(async (): Promise<UserSessionCheckResult> => {
  const policy = getUserSessionPolicy();
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(policy.cookieName)?.value;
  if (!rawToken) return { status: "UNAUTHENTICATED" };

  const db = getDb();
  const tokenHash = sha256Hex(rawToken);
  const rows = await db
    .select({
      sessionId: authSessions.id,
      revokedAt: authSessions.revokedAt,
      revokedReason: authSessions.revokedReason,
      userId: users.id,
      accountId: users.accountId,
      nickname: users.nickname,
      userStatus: users.status,
      userDeleted: users.isDeleted,
      termsAgreedAt: users.termsAgreedAt,
      onboardingCompletedAt: users.onboardingCompletedAt,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(and(eq(authSessions.tokenHash, tokenHash), eq(authSessions.isDeleted, false)))
    .limit(1);

  const row = rows[0];
  if (!row) return { status: "REVOKED", reason: "expired" };
  if (row.revokedAt) {
    return {
      status: "REVOKED",
      reason: row.revokedReason === "DUPLICATE_LOGIN" ? "duplicate" : "expired",
    };
  }
  if (row.userDeleted || row.userStatus !== "ACTIVE") {
    return { status: "REVOKED", reason: "suspended" };
  }

  return {
    status: "AUTHENTICATED",
    user: {
      sessionId: row.sessionId,
      userId: row.userId,
      accountId: row.accountId,
      nickname: row.nickname,
      status: row.userStatus,
      termsAgreed: row.termsAgreedAt !== null,
      onboardingCompleted: row.onboardingCompletedAt !== null,
    },
  };
});

export async function getCurrentUserSession(): Promise<AuthenticatedUser | null> {
  const result = await checkCurrentUserSession();
  return result.status === "AUTHENTICATED" ? result.user : null;
}

export async function requireUserSession(options?: {
  allowUnagreedTerms?: boolean;
}): Promise<AuthenticatedUser> {
  const result = await checkCurrentUserSession();
  if (result.status === "AUTHENTICATED") {
    if (!options?.allowUnagreedTerms && !result.user.termsAgreed) {
      redirect("/app/onboarding/extra");
    }
    return result.user;
  }
  if (result.status === "REVOKED") {
    redirect(`/api/auth/session-expired?scope=app&reason=${encodeURIComponent(result.reason)}`);
  }
  redirect("/app/onboarding/login");
}

export async function createUserSession(userId: number): Promise<void> {
  const policy = getUserSessionPolicy();
  const db = getDb();
  const rawToken = generateRandomToken(32);
  const tokenHash = sha256Hex(rawToken);
  const hdrs = await headers();
  const userAgent = hdrs.get("user-agent");
  const ipAddress = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";

  await db.transaction(async (tx) => {
    // 단일 세션 정책: 기존 활성 세션 DUPLICATE_LOGIN 즉시 폐기
    await tx
      .update(authSessions)
      .set({
        revokedAt: new Date(),
        revokedReason: "DUPLICATE_LOGIN",
        updatedBy: userId,
      })
      .where(
        and(
          eq(authSessions.userId, userId),
          isNull(authSessions.revokedAt),
          eq(authSessions.isDeleted, false),
        ),
      );

    await tx.insert(authSessions).values({
      userId,
      tokenHash,
      userAgent,
      ipAddress,
      createdBy: userId,
    });

    await tx
      .update(users)
      .set({ lastLoginAt: new Date(), updatedBy: userId })
      .where(eq(users.id, userId));
  });

  const cookieStore = await cookies();
  cookieStore.set(policy.cookieName, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: policy.cookiePath,
    maxAge: policy.cookieMaxAgeSeconds,
  });
}

export async function revokeAllUserSessions(
  userId: number,
  reason: "LOGOUT" | "SECURITY_RESET" | "ADMIN_FORCE",
): Promise<void> {
  const db = getDb();
  await db
    .update(authSessions)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
}

export type AdminSessionCheckResult =
  | { status: "AUTHENTICATED"; admin: AuthenticatedAdmin }
  | { status: "UNAUTHENTICATED" }
  | { status: "REVOKED"; reason: string };

export const checkCurrentAdminSession = cache(async (): Promise<AdminSessionCheckResult> => {
  const policy = getAdminSessionPolicy();
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(policy.sessionCookieName)?.value;
  if (!rawToken) return { status: "UNAUTHENTICATED" };

  const db = getDb();
  const tokenHash = sha256Hex(rawToken);
  const rows = await db
    .select({
      sessionId: adminSessions.id,
      expiresAt: adminSessions.expiresAt,
      revokedAt: adminSessions.revokedAt,
      revokedReason: adminSessions.revokedReason,
      adminId: admins.id,
      email: admins.email,
      name: admins.name,
      role: admins.role,
      adminStatus: admins.status,
      adminDeleted: admins.isDeleted,
    })
    .from(adminSessions)
    .innerJoin(admins, eq(adminSessions.adminId, admins.id))
    .where(and(eq(adminSessions.tokenHash, tokenHash), eq(adminSessions.isDeleted, false)))
    .limit(1);

  const row = rows[0];
  if (!row) return { status: "REVOKED", reason: "expired" };
  if (row.revokedAt) {
    return {
      status: "REVOKED",
      reason: row.revokedReason === "DUPLICATE_LOGIN" ? "duplicate" : "expired",
    };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { status: "REVOKED", reason: "idle_timeout" };
  }
  if (row.adminDeleted || row.adminStatus !== "ACTIVE") {
    return { status: "REVOKED", reason: "locked" };
  }

  // 30분 슬라이딩 만료 연장 (비동기 경량 업데이트)
  const nextExpiresAt = new Date(Date.now() + policy.idleMs);
  await db
    .update(adminSessions)
    .set({ expiresAt: nextExpiresAt, lastSeenAt: new Date() })
    .where(eq(adminSessions.id, row.sessionId));

  return {
    status: "AUTHENTICATED",
    admin: {
      sessionId: row.sessionId,
      adminId: row.adminId,
      email: row.email,
      name: row.name,
      role: row.role,
    },
  };
});

export async function getCurrentAdminSession(): Promise<AuthenticatedAdmin | null> {
  const result = await checkCurrentAdminSession();
  return result.status === "AUTHENTICATED" ? result.admin : null;
}

export async function requireAdminSession(allowedRoles?: AdminRole[]): Promise<AuthenticatedAdmin> {
  const result = await checkCurrentAdminSession();
  if (result.status === "UNAUTHENTICATED") {
    redirect("/admin/login");
  }
  if (result.status === "REVOKED") {
    redirect(`/api/auth/session-expired?scope=admin&reason=${encodeURIComponent(result.reason)}`);
  }
  if (allowedRoles && !allowedRoles.includes(result.admin.role)) {
    redirect(result.admin.role === "TRAINER" ? "/admin/trainer" : "/admin/dashboard");
  }
  return result.admin;
}

export async function createAdminSession(adminId: number): Promise<void> {
  const policy = getAdminSessionPolicy();
  const db = getDb();
  const rawToken = generateRandomToken(32);
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + policy.idleMs);
  const hdrs = await headers();
  const userAgent = hdrs.get("user-agent");
  const ipAddress = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";

  await db.transaction(async (tx) => {
    await tx
      .update(adminSessions)
      .set({
        revokedAt: new Date(),
        revokedReason: "DUPLICATE_LOGIN",
        updatedBy: adminId,
      })
      .where(
        and(
          eq(adminSessions.adminId, adminId),
          isNull(adminSessions.revokedAt),
          eq(adminSessions.isDeleted, false),
        ),
      );

    await tx.insert(adminSessions).values({
      adminId,
      tokenHash,
      expiresAt,
      userAgent,
      ipAddress,
      createdBy: adminId,
    });

    await tx
      .update(admins)
      .set({ lastLoginAt: new Date(), failedLoginCount: 0, updatedBy: adminId })
      .where(eq(admins.id, adminId));
  });

  const cookieStore = await cookies();
  cookieStore.set(policy.sessionCookieName, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: policy.cookiePath,
    maxAge: Math.floor(policy.idleMs / 1000),
  });
}
