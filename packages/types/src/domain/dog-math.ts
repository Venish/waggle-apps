export type AgeTagCode = "puppy" | "adolescent" | "adult" | "senior";

export function calcAgeMonths(birthDate: Date, referenceDate = new Date()): number {
  const years = referenceDate.getFullYear() - birthDate.getFullYear();
  const months = referenceDate.getMonth() - birthDate.getMonth();
  const dayDiff = referenceDate.getDate() - birthDate.getDate();
  return Math.max(0, years * 12 + months + (dayDiff < 0 ? -1 : 0));
}

export function calcAgeTag(birthDate: Date, referenceDate = new Date()): AgeTagCode {
  const ageMonths = calcAgeMonths(birthDate, referenceDate);
  if (ageMonths <= 6) return "puppy";
  if (ageMonths <= 12) return "adolescent";
  if (ageMonths <= 84) return "adult";
  return "senior";
}

const MS_PER_DAY = 86_400_000;

export function parseBirthDate(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const matched = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(value);
  if (!matched) throw new Error(`생일 형식이 올바르지 않습니다: ${value}`);
  const [, year, month, day] = matched;
  return new Date(Date.UTC(Number(year), Number(month) - 1, day ? Number(day) : 1));
}

export function calcDaysSinceBirth(birthDate: string | Date, referenceDate = new Date()): number {
  const birth = parseBirthDate(birthDate).getTime();
  const today = Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  return Math.max(0, Math.floor((today - birth) / MS_PER_DAY) + 1);
}

export function formatDPlus(birthDate: string | Date, referenceDate = new Date()): string {
  const days = calcDaysSinceBirth(birthDate, referenceDate);
  return days === 0 ? "D-day" : `D+${days.toLocaleString("ko-KR")}`;
}

export const MAX_GRADE = 5;

export interface GradeTierPolicy {
  grade: number;
  title: string;
  minLessons: number;
}

export const DEFAULT_GRADE_TIERS: readonly GradeTierPolicy[] = [
  { grade: 1, title: "유치원 1학년", minLessons: 0 },
  { grade: 2, title: "초등 2학년", minLessons: 3 },
  { grade: 3, title: "중등 3학년", minLessons: 8 },
  { grade: 4, title: "고등 4학년", minLessons: 15 },
  { grade: 5, title: "우등 5학년", minLessons: 25 },
] as const;

export function calcGradeFromCompletion(completedCourseLevels: number[]): number {
  if (completedCourseLevels.length === 0) return 1;
  const highest = Math.max(...completedCourseLevels);
  return Math.max(1, Math.min(MAX_GRADE, highest + 1));
}

/**
 * 누적 완료 레슨 수 기반 강아지 학년 산출 (policy_configs `grade.tiers` 연동)
 * - preventDemotion=true(기본): 정책 기준 상향 시 기존 달성 학년 강등 방지
 */
export function calcGradeFromLessonCount(
  completedLessons: number,
  tiers: readonly GradeTierPolicy[] = DEFAULT_GRADE_TIERS,
  currentGrade = 1,
  preventDemotion = true,
): number {
  const sorted = [...tiers].sort((a, b) => a.grade - b.grade);
  let calculated = sorted[0]?.grade ?? 1;
  for (const t of sorted) {
    if (completedLessons >= t.minLessons) {
      calculated = t.grade;
    }
  }
  return preventDemotion ? Math.max(currentGrade, calculated) : calculated;
}

export function formatGradeLabel(grade: number, tiers?: readonly GradeTierPolicy[]): string {
  const source = tiers && tiers.length > 0 ? tiers : DEFAULT_GRADE_TIERS;
  const matched = source.find((t) => t.grade === grade);
  return matched?.title ?? `${grade}학년`;
}
