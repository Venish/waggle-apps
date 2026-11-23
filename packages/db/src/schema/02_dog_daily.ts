import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./01_auth";
import { idColumn, mutableAuditColumns } from "./_helpers";

export const sizeClassEnum = pgEnum("size_class", ["SMALL", "MEDIUM", "LARGE"]);
export const genderEnum = pgEnum("gender", ["MALE", "FEMALE"]);
export const stickerKindEnum = pgEnum("sticker_kind", [
  "POOP",
  "MEAL",
  "MEDICINE",
  "HOSPITAL",
  "WALK",
  "CUSTOM",
]);

// 8. breeds [MUTABLE]
export const breeds = pgTable(
  "breeds",
  {
    id: idColumn(),
    code: varchar("code", { length: 60 }).notNull(),
    nameKo: varchar("name_ko", { length: 80 }).notNull(),
    nameEn: varchar("name_en", { length: 100 }).notNull(),
    defaultSize: sizeClassEnum("default_size").notNull().default("SMALL"),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_breeds_code_active")
      .on(t.code)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 9. dogs [MUTABLE]
export const dogs = pgTable(
  "dogs",
  {
    id: idColumn(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 60 }).notNull(),
    birthDate: date("birth_date").notNull(),
    breedId: bigint("breed_id", { mode: "number" }).references(() => breeds.id, {
      onDelete: "restrict",
    }),
    sizeClass: sizeClassEnum("size_class").notNull().default("SMALL"),
    gender: genderEnum("gender").notNull().default("MALE"),
    neutered: boolean("neutered").notNull().default(false),
    weightKg: numeric("weight_kg", { precision: 5, scale: 2 }),
    region: varchar("region", { length: 100 }),
    profileImage: text("profile_image"),
    grade: integer("grade").notNull().default(1),
    isPrimary: boolean("is_primary").notNull().default(false),
    ...mutableAuditColumns(),
  },
  (t) => [index("idx_dogs_user_active").on(t.userId, t.isDeleted)],
);

// 10. anniversaries [MUTABLE]
export const anniversaries = pgTable(
  "anniversaries",
  {
    id: idColumn(),
    dogId: bigint("dog_id", { mode: "number" })
      .notNull()
      .references(() => dogs.id, { onDelete: "restrict" }),
    label: varchar("label", { length: 60 }).notNull(),
    date: date("date").notNull(),
    ...mutableAuditColumns(),
  },
  (t) => [index("idx_anniversaries_dog").on(t.dogId)],
);

// 11. daily_entries [MUTABLE]
export const dailyEntries = pgTable(
  "daily_entries",
  {
    id: idColumn(),
    dogId: bigint("dog_id", { mode: "number" })
      .notNull()
      .references(() => dogs.id, { onDelete: "restrict" }),
    entryDate: date("entry_date").notNull(),
    walked: boolean("walked").notNull().default(false),
    weightKg: numeric("weight_kg", { precision: 5, scale: 2 }),
    photoUrls: jsonb("photo_urls").$type<string[]>().notNull().default([]),
    memo: text("memo"),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_daily_entries_dog_date_active")
      .on(t.dogId, t.entryDate)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 12. daily_entry_stickers [MUTABLE]
export const dailyEntryStickers = pgTable(
  "daily_entry_stickers",
  {
    id: idColumn(),
    entryId: bigint("entry_id", { mode: "number" })
      .notNull()
      .references(() => dailyEntries.id, { onDelete: "restrict" }),
    kind: stickerKindEnum("kind").notNull(),
    note: text("note"),
    photoUrl: text("photo_url"),
    ...mutableAuditColumns(),
  },
  (t) => [index("idx_daily_stickers_entry").on(t.entryId)],
);

// 13. common_codes [MUTABLE]
export const commonCodes = pgTable(
  "common_codes",
  {
    id: idColumn(),
    codeGroup: varchar("code_group", { length: 60 }).notNull(),
    code: varchar("code", { length: 60 }).notNull(),
    codeKorName: varchar("code_kor_name", { length: 100 }).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    extra: jsonb("extra"),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_common_codes_group_code_active")
      .on(t.codeGroup, t.code)
      .where(sql`${t.isDeleted} = false`),
    index("idx_common_codes_group_sort").on(t.codeGroup, t.isActive, t.sortOrder),
  ],
);

// 14. vaccination_records [MUTABLE]
export const vaccinationRecords = pgTable(
  "vaccination_records",
  {
    id: idColumn(),
    dogId: bigint("dog_id", { mode: "number" })
      .notNull()
      .references(() => dogs.id, { onDelete: "restrict" }),
    vaccineId: bigint("vaccine_id", { mode: "number" })
      .notNull()
      .references(() => commonCodes.id, { onDelete: "restrict" }),
    administeredAt: timestamp("administered_at", { withTimezone: true, precision: 3 }).notNull(),
    nextDueAt: timestamp("next_due_at", { withTimezone: true, precision: 3 }),
    hospital: varchar("hospital", { length: 120 }),
    memo: text("memo"),
    ...mutableAuditColumns(),
  },
  (t) => [index("idx_vaccination_dog_due").on(t.dogId, t.nextDueAt)],
);
