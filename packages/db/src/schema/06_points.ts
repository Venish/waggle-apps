import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./01_auth";
import { idColumn, mutableAuditColumns } from "./_helpers";

export const pointReasonEnum = pgEnum("point_reason", [
  "EARN_EDUCATION_WATCH",
  "EARN_EDUCATION_PRACTICE",
  "EARN_EDUCATION_QUIZ",
  "EARN_BONUS_UNIT",
  "EARN_BONUS_COURSE",
  "EARN_LEVEL_TEST",
  "EARN_RECHARGE",
  "REVIEW_REWARD",
  "SPEND_SHOP",
  "SPEND_INQUIRY",
  "SPEND_COURSE_UNLOCK",
  "REFUND",
  "RECHARGE_REFUND",
  "EXPIRE",
  "ADMIN_GRANT",
  "ADMIN_REVOKE",
]);

export const rechargeChannelEnum = pgEnum("recharge_channel", [
  "WEB_PG",
  "IOS_IAP",
  "ANDROID_IAP",
]);

export const rechargeStatusEnum = pgEnum("recharge_status", [
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUND_REQUESTED",
  "REFUNDED",
]);

// 36. point_wallets [MUTABLE]
export const pointWallets = pgTable(
  "point_wallets",
  {
    id: idColumn(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    balance: bigint("balance", { mode: "number" }).notNull().default(0),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_point_wallets_user_active")
      .on(t.userId)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 37. point_ledgers [APPEND_ONLY] — 원장 불변(remainingAmount만 FIFO 전이)
export const pointLedgers = pgTable(
  "point_ledgers",
  {
    id: idColumn(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    dogId: bigint("dog_id", { mode: "number" }),
    delta: bigint("delta", { mode: "number" }).notNull(),
    balanceAfter: bigint("balance_after", { mode: "number" }).notNull(),
    reason: pointReasonEnum("reason").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 191 }),
    refType: varchar("ref_type", { length: 40 }),
    refId: bigint("ref_id", { mode: "number" }),
    memo: text("memo"),
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }),
    remainingAmount: bigint("remaining_amount", { mode: "number" }),
    createdBy: bigint("created_by", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_point_ledgers_idempotency")
      .on(t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
    index("idx_point_ledgers_user_created").on(t.userId, t.createdAt),
    index("idx_point_ledgers_user_expires").on(t.userId, t.expiresAt),
  ],
);

// 38. payment_event_logs [APPEND_ONLY]
export const paymentEventLogs = pgTable(
  "payment_event_logs",
  {
    id: idColumn(),
    provider: varchar("provider", { length: 40 }).notNull(),
    eventId: varchar("event_id", { length: 191 }).notNull(),
    rechargeId: bigint("recharge_id", { mode: "number" }),
    eventType: varchar("event_type", { length: 80 }),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_payment_event_provider_id").on(t.provider, t.eventId),
    index("idx_payment_event_recharge").on(t.rechargeId),
  ],
);

// 39. point_recharges [MUTABLE]
export const pointRecharges = pgTable(
  "point_recharges",
  {
    id: idColumn(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    channel: rechargeChannelEnum("channel").notNull(),
    packageCode: varchar("package_code", { length: 60 }),
    pointAmount: bigint("point_amount", { mode: "number" }).notNull(),
    paidAmount: bigint("paid_amount", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("KRW"),
    provider: varchar("provider", { length: 40 }).notNull(),
    paymentId: varchar("payment_id", { length: 191 }),
    idempotencyKey: varchar("idempotency_key", { length: 100 }),
    receipt: jsonb("receipt"),
    status: rechargeStatusEnum("status").notNull().default("PENDING"),
    paidAt: timestamp("paid_at", { withTimezone: true, precision: 3 }),
    refundedAt: timestamp("refunded_at", { withTimezone: true, precision: 3 }),
    refundReason: text("refund_reason"),
    refundedPointAmount: bigint("refunded_point_amount", { mode: "number" }),
    refundedCashAmount: bigint("refunded_cash_amount", { mode: "number" }),
    adminRejectReason: text("admin_reject_reason"),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_point_recharges_provider_payment")
      .on(t.provider, t.paymentId)
      .where(sql`${t.paymentId} IS NOT NULL AND ${t.isDeleted} = false`),
    uniqueIndex("uq_point_recharges_idempotency")
      .on(t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
    index("idx_point_recharges_user_created").on(t.userId, t.createdAt),
  ],
);
