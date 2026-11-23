import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./01_auth";
import { dogs } from "./02_dog_daily";
import { idColumn, mutableAuditColumns } from "./_helpers";

export const badgeKindEnum = pgEnum("badge_kind", [
  "COURSE_COMPLETE",
  "UNIT_COMPLETE",
  "MILESTONE",
  "EVENT",
]);

// 33. daily_goals [MUTABLE]
export const dailyGoals = pgTable(
  "daily_goals",
  {
    id: idColumn(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    dailyLessonGoal: integer("daily_lesson_goal").notNull().default(1),
    reminderEnabled: boolean("reminder_enabled").notNull().default(true),
    reminderTime: varchar("reminder_time", { length: 10 }).default("20:00"),
    reminderDays: jsonb("reminder_days")
      .$type<number[]>()
      .notNull()
      .default([0, 1, 2, 3, 4, 5, 6]),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_daily_goals_user_active")
      .on(t.userId)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 34. badges [MUTABLE]
export const badges = pgTable(
  "badges",
  {
    id: idColumn(),
    code: varchar("code", { length: 80 }).notNull(),
    kind: badgeKindEnum("kind").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    iconName: varchar("icon_name", { length: 60 }).notNull().default("Award"),
    description: text("description"),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_badges_code_active")
      .on(t.code)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 35. dog_badges [MUTABLE]
export const dogBadges = pgTable(
  "dog_badges",
  {
    id: idColumn(),
    dogId: bigint("dog_id", { mode: "number" })
      .notNull()
      .references(() => dogs.id, { onDelete: "restrict" }),
    badgeId: bigint("badge_id", { mode: "number" })
      .notNull()
      .references(() => badges.id, { onDelete: "restrict" }),
    earnedAt: timestamp("earned_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_dog_badges_active")
      .on(t.dogId, t.badgeId)
      .where(sql`${t.isDeleted} = false`),
  ],
);
