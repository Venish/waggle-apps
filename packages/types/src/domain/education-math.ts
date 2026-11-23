export type LessonNodeStatus = "completed" | "current" | "available" | "locked";

export interface OrderedLessonRef {
  lessonId: number;
  unitOrder: number;
  lessonOrder: number;
}

export function sortLessonPath(lessons: OrderedLessonRef[]): OrderedLessonRef[] {
  return [...lessons].sort((a, b) => a.unitOrder - b.unitOrder || a.lessonOrder - b.lessonOrder);
}

/**
 * 해금된 강좌 내부의 강의 상태 계산 (강좌 내 자유 수강 원칙)
 * - 완료한 강의: "completed"
 * - 미완료 중 가장 앞선 추천 강의: "current" (• 다음 / 이어서 수강하기 대상)
 * - 나머지 미완료 강의: "available" (잠금 없이 자유 클릭 가능; "locked"는 미해제 프리미엄 강좌 전용)
 */
export function computeLessonStates(
  lessons: OrderedLessonRef[],
  completedLessonIds: ReadonlySet<number>,
): Map<number, LessonNodeStatus> {
  const path = sortLessonPath(lessons);
  const states = new Map<number, LessonNodeStatus>();
  let currentAssigned = false;

  for (let i = 0; i < path.length; i += 1) {
    const lesson = path[i]!;
    if (completedLessonIds.has(lesson.lessonId)) {
      states.set(lesson.lessonId, "completed");
      continue;
    }
    if (!currentAssigned) {
      states.set(lesson.lessonId, "current");
      currentAssigned = true;
    } else {
      states.set(lesson.lessonId, "available");
    }
  }
  return states;
}

export function calcProgressPercent(totalLessons: number, completedLessons: number): number {
  if (totalLessons <= 0) return 0;
  return Math.min(100, Math.floor((completedLessons / totalLessons) * 100));
}

export interface QuizGradeResult {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
}

export function gradeQuiz(
  selected: number[],
  correct: number[],
  passPercent: number,
): QuizGradeResult {
  if (correct.length === 0) {
    return { score: 0, total: 0, percent: 0, passed: false };
  }
  if (selected.length !== correct.length) {
    throw new Error(`답안 개수(${selected.length})가 문항 수(${correct.length})와 다릅니다.`);
  }
  const score = correct.reduce((acc, ans, idx) => acc + (selected[idx] === ans ? 1 : 0), 0);
  const percent = Math.floor((score / correct.length) * 100);
  return { score, total: correct.length, percent, passed: percent >= passPercent };
}
