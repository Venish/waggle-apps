export interface WeightedTag {
  code: string;
  weight: number;
}

export interface CourseForMatching {
  courseId: number;
  tags: WeightedTag[];
}

export interface CourseMatchScore {
  courseId: number;
  score: number;
  matchedTags: string[];
}

export function mergeDogTags(tags: WeightedTag[]): Map<string, number> {
  const merged = new Map<string, number>();
  for (const { code, weight } of tags) {
    merged.set(code, (merged.get(code) ?? 0) + weight);
  }
  return merged;
}

export function scoreCourses(
  dogTags: WeightedTag[],
  courses: CourseForMatching[],
): CourseMatchScore[] {
  const dogTagMap = mergeDogTags(dogTags);
  return courses
    .map((course) => {
      let score = 0;
      const matchedTags: string[] = [];
      for (const tag of course.tags) {
        const dogWeight = dogTagMap.get(tag.code);
        if (dogWeight !== undefined) {
          score += dogWeight * tag.weight;
          matchedTags.push(tag.code);
        }
      }
      return { courseId: course.courseId, score, matchedTags };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

export interface EarnRow {
  id: number;
  remainingAmount: number;
  expiresAt: Date | null;
}

export interface FifoConsumption {
  id: number;
  consume: number;
}

export interface FifoPlan {
  consumptions: FifoConsumption[];
  shortfall: number;
}

export function planFifoConsumption(rows: EarnRow[], amount: number): FifoPlan {
  if (amount <= 0) return { consumptions: [], shortfall: 0 };

  const sorted = [...rows]
    .filter((r) => r.remainingAmount > 0)
    .sort((a, b) => {
      if (a.expiresAt === null && b.expiresAt === null) return 0;
      if (a.expiresAt === null) return 1;
      if (b.expiresAt === null) return -1;
      return a.expiresAt.getTime() - b.expiresAt.getTime();
    });

  const consumptions: FifoConsumption[] = [];
  let left = amount;
  for (const row of sorted) {
    if (left === 0) break;
    const consume = Math.min(row.remainingAmount, left);
    consumptions.push({ id: row.id, consume });
    left -= consume;
  }
  return { consumptions, shortfall: left };
}
