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
import { dogs } from "./02_dog_daily";
import { idColumn, mutableAuditColumns } from "./_helpers";

export const lessonStepTypeEnum = pgEnum("lesson_step_type", ["VIDEO", "PRACTICE", "QUIZ"]);
export const enrollmentStatusEnum = pgEnum("enrollment_status", ["IN_PROGRESS", "COMPLETED"]);
export const completionViaEnum = pgEnum("completion_via", ["NORMAL", "LEVEL_TEST"]);

// 15. courses [MUTABLE]
export const courses = pgTable(
  "courses",
  {
    id: idColumn(),
    code: varchar("code", { length: 80 }).notNull(),
    title: varchar("title", { length: 150 }).notNull(),
    description: text("description"),
    level: integer("level").notNull().default(1),
    coverImage: text("cover_image"),
    isPremium: boolean("is_premium").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_courses_code_active")
      .on(t.code)
      .where(sql`${t.isDeleted} = false`),
    index("idx_courses_pub_order").on(t.isPublished, t.sortOrder),
  ],
);

// 16. units [MUTABLE]
export const units = pgTable(
  "units",
  {
    id: idColumn(),
    courseId: bigint("course_id", { mode: "number" })
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 150 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_units_course_order_active")
      .on(t.courseId, t.sortOrder)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 17. lessons [MUTABLE]
export const lessons = pgTable(
  "lessons",
  {
    id: idColumn(),
    unitId: bigint("unit_id", { mode: "number" })
      .notNull()
      .references(() => units.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 150 }).notNull(),
    summary: text("summary"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_lessons_unit_order_active")
      .on(t.unitId, t.sortOrder)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 18. lesson_steps [MUTABLE]
export const lessonSteps = pgTable(
  "lesson_steps",
  {
    id: idColumn(),
    lessonId: bigint("lesson_id", { mode: "number" })
      .notNull()
      .references(() => lessons.id, { onDelete: "restrict" }),
    type: lessonStepTypeEnum("type").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    youtubeVideoId: varchar("youtube_video_id", { length: 40 }),
    videoUrl: text("video_url"),
    videoDurationS: integer("video_duration_s"),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_lesson_steps_lesson_type_active")
      .on(t.lessonId, t.type)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 19. practice_checklists [MUTABLE]
export const practiceChecklists = pgTable(
  "practice_checklists",
  {
    id: idColumn(),
    stepId: bigint("step_id", { mode: "number" })
      .notNull()
      .references(() => lessonSteps.id, { onDelete: "restrict" }),
    text: text("text").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...mutableAuditColumns(),
  },
  (t) => [index("idx_practice_checklists_step").on(t.stepId, t.sortOrder)],
);

// 20. quizzes [MUTABLE]
export const quizzes = pgTable(
  "quizzes",
  {
    id: idColumn(),
    stepId: bigint("step_id", { mode: "number" })
      .notNull()
      .references(() => lessonSteps.id, { onDelete: "restrict" }),
    passPercentOverride: integer("pass_percent_override"),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_quizzes_step_active")
      .on(t.stepId)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 21. quiz_questions [MUTABLE]
export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: idColumn(),
    quizId: bigint("quiz_id", { mode: "number" })
      .notNull()
      .references(() => quizzes.id, { onDelete: "restrict" }),
    text: text("text").notNull(),
    choices: jsonb("choices").$type<string[]>().notNull(),
    answerIndex: integer("answer_index").notNull(),
    explanation: text("explanation"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...mutableAuditColumns(),
  },
  (t) => [index("idx_quiz_questions_quiz").on(t.quizId, t.sortOrder)],
);

// 22. quiz_attempts [APPEND_ONLY]
export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: idColumn(),
    quizId: bigint("quiz_id", { mode: "number" })
      .notNull()
      .references(() => quizzes.id, { onDelete: "restrict" }),
    dogId: bigint("dog_id", { mode: "number" })
      .notNull()
      .references(() => dogs.id, { onDelete: "restrict" }),
    answers: jsonb("answers").$type<Array<{ questionId: number; selectedIndex: number }>>().notNull(),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    passed: boolean("passed").notNull(),
    createdBy: bigint("created_by", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [index("idx_quiz_attempts_dog_quiz").on(t.dogId, t.quizId, t.createdAt)],
);

// 23. enrollments [MUTABLE]
export const enrollments = pgTable(
  "enrollments",
  {
    id: idColumn(),
    dogId: bigint("dog_id", { mode: "number" })
      .notNull()
      .references(() => dogs.id, { onDelete: "restrict" }),
    courseId: bigint("course_id", { mode: "number" })
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    status: enrollmentStatusEnum("status").notNull().default("IN_PROGRESS"),
    startedAt: timestamp("started_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, precision: 3 }),
    completionBonusAwarded: boolean("completion_bonus_awarded").notNull().default(false),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_enrollments_dog_course_active")
      .on(t.dogId, t.courseId)
      .where(sql`${t.isDeleted} = false`),
    index("idx_enrollments_dog_status").on(t.dogId, t.status),
  ],
);

// 24. lesson_progresses [MUTABLE]
export const lessonProgresses = pgTable(
  "lesson_progresses",
  {
    id: idColumn(),
    dogId: bigint("dog_id", { mode: "number" })
      .notNull()
      .references(() => dogs.id, { onDelete: "restrict" }),
    lessonId: bigint("lesson_id", { mode: "number" })
      .notNull()
      .references(() => lessons.id, { onDelete: "restrict" }),
    watchMaxPercent: integer("watch_max_percent").notNull().default(0),
    watchCompletedAt: timestamp("watch_completed_at", { withTimezone: true, precision: 3 }),
    practiceCompletedAt: timestamp("practice_completed_at", { withTimezone: true, precision: 3 }),
    quizPassedAt: timestamp("quiz_passed_at", { withTimezone: true, precision: 3 }),
    completedAt: timestamp("completed_at", { withTimezone: true, precision: 3 }),
    completedVia: completionViaEnum("completed_via").notNull().default("NORMAL"),
    watchPointAwarded: boolean("watch_point_awarded").notNull().default(false),
    practicePointAwarded: boolean("practice_point_awarded").notNull().default(false),
    quizPointAwarded: boolean("quiz_point_awarded").notNull().default(false),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_lesson_progress_dog_lesson_active")
      .on(t.dogId, t.lessonId)
      .where(sql`${t.isDeleted} = false`),
    index("idx_lesson_progress_dog_completed").on(t.dogId, t.completedAt),
  ],
);
