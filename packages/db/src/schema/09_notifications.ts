import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
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

export const notificationKindEnum = pgEnum("notification_kind", [
  "COURSE_RECOMMEND",
  "DAILY_GOAL_REMINDER",
  "POINT_EARNED",
  "POINT_EXPIRE_SOON",
  "INQUIRY_ANSWERED",
  "INQUIRY_REFUNDED",
  "BADGE_EARNED",
  "VACCINE_DUE",
  "ORDER_UPDATE",
  "NOTICE",
  "CUSTOM",
]);

// 55. notification_templates [MUTABLE]
export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: idColumn(),
    code: varchar("code", { length: 80 }).notNull(),
    title: varchar("title", { length: 150 }).notNull(),
    body: text("body").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_notification_templates_code_active")
      .on(t.code)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 56. notifications [APPEND_ONLY] — 수신 확인(isRead, readAt) 단방향 갱신만 허용
export const notifications = pgTable(
  "notifications",
  {
    id: idColumn(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    kind: notificationKindEnum("kind").notNull(),
    title: varchar("title", { length: 150 }).notNull(),
    body: text("body").notNull(),
    deepLink: varchar("deep_link", { length: 255 }),
    data: jsonb("data").$type<Record<string, unknown>>(),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true, precision: 3 }),
    createdBy: bigint("created_by", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [index("idx_notifications_user_read").on(t.userId, t.isRead, t.createdAt)],
);
