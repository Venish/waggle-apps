import { bigint, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * 전 테이블 단일 대리키: BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY (GM-101)
 */
export const idColumn = () =>
  bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity();

/**
 * 53개 MUTABLE 테이블 전수 필수 7대 감사(Audit) & 소프트 삭제 컬럼 (00_2 규약)
 */
export const mutableAuditColumns = () => ({
  createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  createdBy: bigint("created_by", { mode: "number" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 3 })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  updatedBy: bigint("updated_by", { mode: "number" }),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true, precision: 3 }),
  deletedBy: bigint("deleted_by", { mode: "number" }),
});
