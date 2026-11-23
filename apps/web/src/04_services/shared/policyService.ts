import "server-only";
import { and, eq, getDb, policyConfigs } from "@repo/db";
import type { GradeTierPolicy } from "@repo/types";

/**
 * GM-011 Strict PolicyConfig Loader (코드 기본 상수 / Fallback 0%, Fail-Fast)
 * 모든 비즈니스 운영 정책값은 PostgreSQL policy_configs 단일 원천에서만 읽으며,
 * 키가 누락되었거나 형식이 불일치하면 즉시 명시적 에러를 발생시킨다.
 */
export async function getPolicyRaw(key: string): Promise<unknown> {
  const db = getDb();
  const rows = await db
    .select({ value: policyConfigs.value })
    .from(policyConfigs)
    .where(and(eq(policyConfigs.key, key), eq(policyConfigs.isDeleted, false)))
    .limit(1);

  if (!rows[0]) {
    throw new Error(`[CONFIG_MISSING] policy_configs에 필수 키 '${key}'가 존재하지 않습니다.`);
  }
  return rows[0].value;
}

export async function getPolicyNumber(key: string): Promise<number> {
  const raw = await getPolicyRaw(key);
  const num = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(num)) {
    throw new Error(`[CONFIG_MISSING] policy_configs '${key}' 값이 유효한 숫자가 아닙니다.`);
  }
  return num;
}

export async function getPolicyBoolean(key: string): Promise<boolean> {
  const raw = await getPolicyRaw(key);
  if (typeof raw !== "boolean") {
    throw new Error(`[CONFIG_MISSING] policy_configs '${key}' 값이 불리언이 아닙니다.`);
  }
  return raw;
}

export async function getPolicyString(key: string): Promise<string> {
  const raw = await getPolicyRaw(key);
  if (typeof raw !== "string") {
    throw new Error(`[CONFIG_MISSING] policy_configs '${key}' 값이 문자열이 아닙니다.`);
  }
  return raw;
}

export interface RechargePackagePolicy {
  code: string;
  label: string;
  pointAmount: number;
  webPrice: number;
  iapPrice: number;
}

export async function getRechargePackagesPolicy(): Promise<RechargePackagePolicy[]> {
  const raw = await getPolicyRaw("recharge.packages");
  if (!Array.isArray(raw)) {
    throw new Error("[CONFIG_MISSING] policy_configs 'recharge.packages' 값이 배열이 아닙니다.");
  }
  return raw as RechargePackagePolicy[];
}

export interface ShopReviewPolicy {
  textRewardPoint: number;
  photoRewardPoint: number;
  minLength: number;
  maxLength: number;
}

export async function getShopReviewPolicy(): Promise<ShopReviewPolicy> {
  const [textRewardPoint, photoRewardPoint, minLength, maxLength] = await Promise.all([
    getPolicyNumber("shop.review.text_reward_point"),
    getPolicyNumber("shop.review.photo_reward_point"),
    getPolicyNumber("shop.review.min_length"),
    getPolicyNumber("shop.review.max_length"),
  ]);
  return {
    textRewardPoint: Math.max(0, Math.floor(textRewardPoint)),
    photoRewardPoint: Math.max(0, Math.floor(photoRewardPoint)),
    minLength: Math.max(1, Math.floor(minLength)),
    maxLength: Math.max(20, Math.floor(maxLength)),
  };
}

export async function getGradeTiersPolicy(): Promise<GradeTierPolicy[]> {
  const raw = await getPolicyRaw("grade.tiers");
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("[CONFIG_MISSING] policy_configs 'grade.tiers' 값이 유효한 배열이 아닙니다.");
  }
  const parsed: GradeTierPolicy[] = raw.map((item) => {
    const obj = item as Record<string, unknown>;
    const grade = Number(obj.grade);
    const minLessons = Number(obj.minLessons);
    const title = typeof obj.title === "string" ? obj.title.trim() : "";
    if (!Number.isInteger(grade) || grade < 1 || !Number.isFinite(minLessons) || minLessons < 0 || !title) {
      throw new Error("[CONFIG_MISSING] policy_configs 'grade.tiers' 항목 형식이 올바르지 않습니다.");
    }
    return { grade, title, minLessons: Math.floor(minLessons) };
  });
  return parsed.sort((a, b) => a.grade - b.grade);
}

export interface EducationPolicies {
  gradeTiers: GradeTierPolicy[];
  watchCompletePercent: number;
  quizPassPercent: number;
  levelTestPassScorePct: number;
  pointWatch: number;
  pointPractice: number;
  pointQuiz: number;
  pointBonusUnit: number;
  pointBonusCourse: number;
  pointDailyEarnCap: number;
}

export async function getEducationPolicies(): Promise<EducationPolicies> {
  const [
    gradeTiers,
    watchCompletePercent,
    quizPassPercent,
    levelTestPassScorePct,
    pointWatch,
    pointPractice,
    pointQuiz,
    pointBonusUnit,
    pointBonusCourse,
    pointDailyEarnCap,
  ] = await Promise.all([
    getGradeTiersPolicy(),
    getPolicyNumber("watch.complete_percent"),
    getPolicyNumber("quiz.pass_percent"),
    getPolicyNumber("level_test.pass_score_pct"),
    getPolicyNumber("point.watch"),
    getPolicyNumber("point.practice"),
    getPolicyNumber("point.quiz"),
    getPolicyNumber("point.bonus.unit"),
    getPolicyNumber("point.bonus.course"),
    getPolicyNumber("point.daily_earn_cap"),
  ]);

  return {
    gradeTiers,
    watchCompletePercent: Math.round(watchCompletePercent),
    quizPassPercent: Math.round(quizPassPercent),
    levelTestPassScorePct: Math.round(levelTestPassScorePct),
    pointWatch: Math.max(0, Math.floor(pointWatch)),
    pointPractice: Math.max(0, Math.floor(pointPractice)),
    pointQuiz: Math.max(0, Math.floor(pointQuiz)),
    pointBonusUnit: Math.max(0, Math.floor(pointBonusUnit)),
    pointBonusCourse: Math.max(0, Math.floor(pointBonusCourse)),
    pointDailyEarnCap: Math.max(0, Math.floor(pointDailyEarnCap)),
  };
}
