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
import { courses } from "./04_education";
import { idColumn, mutableAuditColumns } from "./_helpers";

export const tagCategoryEnum = pgEnum("tag_category", [
  "AGE",
  "EXPERIENCE",
  "PROBLEM",
  "GOAL",
  "ENV",
  "SOCIAL",
  "SPECIALTY",
  "ETC",
]);

export interface LevelTestQuestionItem {
  text: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
}

// 25. survey_questions [MUTABLE]
export const surveyQuestions = pgTable(
  "survey_questions",
  {
    id: idColumn(),
    code: varchar("code", { length: 60 }).notNull(),
    text: text("text").notNull(),
    allowMultiple: boolean("allow_multiple").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_survey_questions_code_active")
      .on(t.code)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 26. survey_answers [MUTABLE]
export const surveyAnswers = pgTable(
  "survey_answers",
  {
    id: idColumn(),
    questionId: bigint("question_id", { mode: "number" })
      .notNull()
      .references(() => surveyQuestions.id, { onDelete: "restrict" }),
    text: varchar("text", { length: 200 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...mutableAuditColumns(),
  },
  (t) => [index("idx_survey_answers_question").on(t.questionId, t.sortOrder)],
);

// 27. survey_responses [MUTABLE]
export const surveyResponses = pgTable(
  "survey_responses",
  {
    id: idColumn(),
    dogId: bigint("dog_id", { mode: "number" })
      .notNull()
      .references(() => dogs.id, { onDelete: "restrict" }),
    answerId: bigint("answer_id", { mode: "number" })
      .notNull()
      .references(() => surveyAnswers.id, { onDelete: "restrict" }),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_survey_responses_dog_answer_active")
      .on(t.dogId, t.answerId)
      .where(sql`${t.isDeleted} = false`),
    index("idx_survey_responses_dog").on(t.dogId),
  ],
);

// 28. tags [MUTABLE]
export const tags = pgTable(
  "tags",
  {
    id: idColumn(),
    code: varchar("code", { length: 60 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    category: tagCategoryEnum("category").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_tags_code_active")
      .on(t.code)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 29. course_tags [MUTABLE]
export const courseTags = pgTable(
  "course_tags",
  {
    id: idColumn(),
    courseId: bigint("course_id", { mode: "number" })
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    tagId: bigint("tag_id", { mode: "number" })
      .notNull()
      .references(() => tags.id, { onDelete: "restrict" }),
    weight: integer("weight").notNull().default(1),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_course_tags_active")
      .on(t.courseId, t.tagId)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 30. answer_tags [MUTABLE]
export const answerTags = pgTable(
  "answer_tags",
  {
    id: idColumn(),
    answerId: bigint("answer_id", { mode: "number" })
      .notNull()
      .references(() => surveyAnswers.id, { onDelete: "restrict" }),
    tagId: bigint("tag_id", { mode: "number" })
      .notNull()
      .references(() => tags.id, { onDelete: "restrict" }),
    weight: integer("weight").notNull().default(1),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_answer_tags_active")
      .on(t.answerId, t.tagId)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 31. level_tests [MUTABLE]
export const levelTests = pgTable(
  "level_tests",
  {
    id: idColumn(),
    courseId: bigint("course_id", { mode: "number" })
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 150 }).notNull(),
    skipToUnitOrder: integer("skip_to_unit_order").notNull().default(1),
    questions: jsonb("questions").$type<LevelTestQuestionItem[]>().notNull(),
    passPercentOverride: integer("pass_percent_override"),
    isActive: boolean("is_active").notNull().default(true),
    ...mutableAuditColumns(),
  },
  (t) => [index("idx_level_tests_course").on(t.courseId)],
);

// 32. level_test_attempts [APPEND_ONLY]
export const levelTestAttempts = pgTable(
  "level_test_attempts",
  {
    id: idColumn(),
    levelTestId: bigint("level_test_id", { mode: "number" })
      .notNull()
      .references(() => levelTests.id, { onDelete: "restrict" }),
    dogId: bigint("dog_id", { mode: "number" })
      .notNull()
      .references(() => dogs.id, { onDelete: "restrict" }),
    answers: jsonb("answers").$type<number[]>().notNull(),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    passed: boolean("passed").notNull(),
    createdBy: bigint("created_by", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [index("idx_level_test_attempts_dog").on(t.dogId, t.levelTestId)],
);
