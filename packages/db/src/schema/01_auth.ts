import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { idColumn, mutableAuditColumns } from "./_helpers";

export const authProviderEnum = pgEnum("auth_provider", [
  "EMAIL",
  "KAKAO",
  "NAVER",
  "GOOGLE",
  "APPLE",
]);

export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "SUSPENDED", "DELETED"]);

export const devicePlatformEnum = pgEnum("device_platform", ["IOS", "ANDROID", "WEB"]);

export const adminRoleEnum = pgEnum("admin_role", ["ADMIN", "TRAINER"]);

export const adminStatusEnum = pgEnum("admin_status", ["ACTIVE", "INACTIVE", "LOCKED", "SUSPENDED"]);

// 1. accounts [MUTABLE]
export const accounts = pgTable(
  "accounts",
  {
    id: idColumn(),
    provider: authProviderEnum("provider").notNull(),
    providerId: varchar("provider_id", { length: 191 }).notNull(),
    email: varchar("email", { length: 191 }),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, precision: 3 }),
    passwordHash: text("password_hash"),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true, precision: 3 }),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_accounts_provider_active")
      .on(t.provider, t.providerId)
      .where(sql`${t.isDeleted} = false`),
    index("idx_accounts_email").on(t.email),
  ],
);

// 2. users [MUTABLE]
export const users = pgTable(
  "users",
  {
    id: idColumn(),
    accountId: bigint("account_id", { mode: "number" })
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    nickname: varchar("nickname", { length: 60 }).notNull(),
    phone: varchar("phone", { length: 30 }),
    region: varchar("region", { length: 100 }),
    profileImage: text("profile_image"),
    status: userStatusEnum("status").notNull().default("ACTIVE"),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    pushOptIn: boolean("push_opt_in").notNull().default(true),
    educationPushOptIn: boolean("education_push_opt_in").notNull().default(true),
    termsAgreedAt: timestamp("terms_agreed_at", { withTimezone: true, precision: 3 }),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true, precision: 3 }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true, precision: 3 }),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_users_account_active")
      .on(t.accountId)
      .where(sql`${t.isDeleted} = false`),
    index("idx_users_status").on(t.status),
  ],
);

// 3. devices [MUTABLE]
export const devices = pgTable(
  "devices",
  {
    id: idColumn(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    platform: devicePlatformEnum("platform").notNull(),
    pushToken: varchar("push_token", { length: 512 }).notNull(),
    appVersion: varchar("app_version", { length: 32 }),
    osVersion: varchar("os_version", { length: 32 }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_devices_user_token_active")
      .on(t.userId, t.pushToken)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 4. auth_sessions [MUTABLE] — 보호자 SHA-256 단일 세션 (자동 로그아웃 없음, DUPLICATE_LOGIN 폐기)
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: idColumn(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 64 }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, precision: 3 }),
    revokedReason: varchar("revoked_reason", { length: 40 }), // DUPLICATE_LOGIN | LOGOUT | SECURITY_RESET | ADMIN_FORCE
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_auth_sessions_hash").on(t.tokenHash),
    index("idx_auth_sessions_user_active").on(t.userId, t.revokedAt),
  ],
);

// 5. admins [MUTABLE]
export const admins = pgTable(
  "admins",
  {
    id: idColumn(),
    email: varchar("email", { length: 191 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    name: varchar("name", { length: 60 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),
    role: adminRoleEnum("role").notNull().default("ADMIN"),
    status: adminStatusEnum("status").notNull().default("ACTIVE"),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedAt: timestamp("locked_at", { withTimezone: true, precision: 3 }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true, precision: 3 }),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_admins_email_active")
      .on(t.email)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 6. admin_sessions [MUTABLE] — 관리자 SHA-256 30분 슬라이딩 단일 세션
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: idColumn(),
    adminId: bigint("admin_id", { mode: "number" })
      .notNull()
      .references(() => admins.id, { onDelete: "restrict" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 64 }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, precision: 3 }),
    revokedReason: varchar("revoked_reason", { length: 40 }),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_admin_sessions_hash").on(t.tokenHash),
    index("idx_admin_sessions_admin_active").on(t.adminId, t.revokedAt),
  ],
);

// 7. admin_otp_codes [MUTABLE] — 2단계 SMS 인증번호
export const adminOtpCodes = pgTable(
  "admin_otp_codes",
  {
    id: idColumn(),
    adminId: bigint("admin_id", { mode: "number" })
      .notNull()
      .references(() => admins.id, { onDelete: "restrict" }),
    challengeTokenHash: varchar("challenge_token_hash", { length: 64 }).notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    devPlainCode: varchar("dev_plain_code", { length: 12 }), // NODE_ENV !== production Mock 표시용
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true, precision: 3 }),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_admin_otp_challenge").on(t.challengeTokenHash),
    index("idx_admin_otp_admin").on(t.adminId, t.expiresAt),
  ],
);
