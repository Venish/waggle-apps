import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { idColumn, mutableAuditColumns } from "./_helpers";

export const bannerPlacementEnum = pgEnum("banner_placement", ["HOME", "SHOP_HOME", "NOTICE"]);

// 57. audit_logs [APPEND_ONLY]
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: idColumn(),
    actorType: varchar("actor_type", { length: 20 }).notNull().default("ADMIN"), // ADMIN | USER | SYSTEM
    actorId: bigint("actor_id", { mode: "number" }),
    action: varchar("action", { length: 80 }).notNull(),
    entity: varchar("entity", { length: 80 }),
    entityId: bigint("entity_id", { mode: "number" }),
    beforeData: jsonb("before_data"),
    afterData: jsonb("after_data"),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_audit_logs_entity").on(t.entity, t.entityId),
    index("idx_audit_logs_actor_created").on(t.actorId, t.createdAt),
    index("idx_audit_logs_action").on(t.action),
  ],
);

// 58. banners [MUTABLE]
export const banners = pgTable(
  "banners",
  {
    id: idColumn(),
    title: varchar("title", { length: 150 }).notNull(),
    subtitle: varchar("subtitle", { length: 200 }),
    imageUrl: text("image_url"),
    linkUrl: varchar("link_url", { length: 255 }),
    placement: bannerPlacementEnum("placement").notNull().default("HOME"),
    accentToken: varchar("accent_token", { length: 40 }).default("brand-lime"),
    startAt: timestamp("start_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    endAt: timestamp("end_at", { withTimezone: true, precision: 3 }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...mutableAuditColumns(),
  },
  (t) => [index("idx_banners_placement_active").on(t.placement, t.isActive, t.sortOrder)],
);

// 59. policy_configs [MUTABLE]
export const policyConfigs = pgTable(
  "policy_configs",
  {
    id: idColumn(),
    key: varchar("key", { length: 100 }).notNull(),
    value: jsonb("value").notNull(),
    description: text("description"),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_policy_configs_key_active")
      .on(t.key)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 60. policy_config_histories [APPEND_ONLY]
export const policyConfigHistories = pgTable(
  "policy_config_histories",
  {
    id: idColumn(),
    policyConfigId: bigint("policy_config_id", { mode: "number" })
      .notNull()
      .references(() => policyConfigs.id, { onDelete: "restrict" }),
    key: varchar("key", { length: 100 }).notNull(),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value").notNull(),
    adminId: bigint("admin_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [index("idx_policy_histories_key_created").on(t.key, t.createdAt)],
);
