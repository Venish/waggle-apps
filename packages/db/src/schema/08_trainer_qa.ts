import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { admins, users } from "./01_auth";
import { dogs } from "./02_dog_daily";
import { tags } from "./03_onboarding";
import { idColumn, mutableAuditColumns } from "./_helpers";

export const inquiryStatusEnum = pgEnum("inquiry_status", [
  "PENDING",
  "ASSIGNED",
  "ANSWERED",
  "EXPIRED",
  "CANCELLED",
]);

export const settlementStatusEnum = pgEnum("settlement_status", ["DRAFT", "CONFIRMED", "PAID"]);

// 51. trainers [MUTABLE]
export const trainers = pgTable(
  "trainers",
  {
    id: idColumn(),
    adminId: bigint("admin_id", { mode: "number" }).references(() => admins.id, {
      onDelete: "restrict",
    }),
    name: varchar("name", { length: 60 }).notNull(),
    bio: text("bio"),
    profileImage: text("profile_image"),
    careerYears: integer("career_years"),
    isActive: boolean("is_active").notNull().default(true),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_trainers_admin_active")
      .on(t.adminId)
      .where(sql`${t.adminId} IS NOT NULL AND ${t.isDeleted} = false`),
  ],
);

// 52. trainer_tags [MUTABLE]
export const trainerTags = pgTable(
  "trainer_tags",
  {
    id: idColumn(),
    trainerId: bigint("trainer_id", { mode: "number" })
      .notNull()
      .references(() => trainers.id, { onDelete: "restrict" }),
    tagId: bigint("tag_id", { mode: "number" })
      .notNull()
      .references(() => tags.id, { onDelete: "restrict" }),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_trainer_tags_active")
      .on(t.trainerId, t.tagId)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 53. inquiries [MUTABLE]
export const inquiries = pgTable(
  "inquiries",
  {
    id: idColumn(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    dogId: bigint("dog_id", { mode: "number" }).references(() => dogs.id, {
      onDelete: "restrict",
    }),
    trainerId: bigint("trainer_id", { mode: "number" }).references(() => trainers.id, {
      onDelete: "restrict",
    }),
    specialtyTagId: bigint("specialty_tag_id", { mode: "number" }).references(() => tags.id, {
      onDelete: "restrict",
    }),
    videoUrl: text("video_url"),
    question: text("question").notNull(),
    paidPoints: bigint("paid_points", { mode: "number" }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 100 }),
    status: inquiryStatusEnum("status").notNull().default("PENDING"),
    assignedAt: timestamp("assigned_at", { withTimezone: true, precision: 3 }),
    slaDueAt: timestamp("sla_due_at", { withTimezone: true, precision: 3 }).notNull(),
    answerText: text("answer_text"),
    answerVideoUrl: text("answer_video_url"),
    answeredAt: timestamp("answered_at", { withTimezone: true, precision: 3 }),
    refundedAt: timestamp("refunded_at", { withTimezone: true, precision: 3 }),
    rating: integer("rating"),
    ratingComment: text("rating_comment"),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_inquiries_idempotency")
      .on(t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
    index("idx_inquiries_user_created").on(t.userId, t.createdAt),
    index("idx_inquiries_trainer_status").on(t.trainerId, t.status),
    index("idx_inquiries_status_sla").on(t.status, t.slaDueAt),
  ],
);

// 54. trainer_settlements [MUTABLE]
export const trainerSettlements = pgTable(
  "trainer_settlements",
  {
    id: idColumn(),
    trainerId: bigint("trainer_id", { mode: "number" })
      .notNull()
      .references(() => trainers.id, { onDelete: "restrict" }),
    periodYm: varchar("period_ym", { length: 7 }).notNull(), // "2026-11"
    totalInquiries: integer("total_inquiries").notNull().default(0),
    totalPoints: bigint("total_points", { mode: "number" }).notNull().default(0),
    commissionRate: numeric("commission_rate", { precision: 5, scale: 4 }).notNull(),
    payoutAmount: bigint("payout_amount", { mode: "number" }).notNull().default(0),
    status: settlementStatusEnum("status").notNull().default("DRAFT"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true, precision: 3 }),
    paidAt: timestamp("paid_at", { withTimezone: true, precision: 3 }),
    memo: text("memo"),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_trainer_settlements_active")
      .on(t.trainerId, t.periodYm)
      .where(sql`${t.isDeleted} = false`),
    index("idx_trainer_settlements_period").on(t.periodYm, t.status),
  ],
);
