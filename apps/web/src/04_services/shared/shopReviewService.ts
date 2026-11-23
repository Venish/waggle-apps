import "server-only";
import { and, asc, eq, getDb, inArray, productImages, productReviews, sql } from "@repo/db";

export interface ProductReviewStats {
  reviewCount: number;
  avgRating: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

/**
 * 공개 후기 작성자 닉네임 마스킹 (예: "초코맘" -> "초코*", "코기아빠" -> "코기**")
 */
export function maskReviewerNickname(nickname: string): string {
  const trimmed = nickname.trim();
  if (!trimmed) return "와글회원";
  if (trimmed.length === 1) return `${trimmed}*`;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed.slice(0, 2)}${"*".repeat(Math.min(4, trimmed.length - 2))}`;
}

/**
 * 상품별 대표 이미지 1장(sortOrder ASC) 일괄 조회 맵
 */
export async function getPrimaryProductImagesMap(
  productIds: number[],
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (productIds.length === 0) return result;

  const db = getDb();
  const rows = await db
    .select({
      productId: productImages.productId,
      url: productImages.url,
    })
    .from(productImages)
    .where(
      and(inArray(productImages.productId, productIds), eq(productImages.isDeleted, false)),
    )
    .orderBy(asc(productImages.sortOrder), asc(productImages.id));

  for (const row of rows) {
    if (!result.has(row.productId)) {
      result.set(row.productId, row.url);
    }
  }
  return result;
}

/**
 * 상품별 공개 후기 집계(개수·평균 별점) 일괄 조회 맵
 */
export async function getProductReviewSummaryMap(
  productIds: number[],
): Promise<Map<number, { count: number; avgRating: number }>> {
  const result = new Map<number, { count: number; avgRating: number }>();
  if (productIds.length === 0) return result;

  const db = getDb();
  const rows = await db
    .select({
      productId: productReviews.productId,
      count: sql<string>`COUNT(*)::text`,
      avg: sql<string>`COALESCE(AVG(${productReviews.rating}), 0)::text`,
    })
    .from(productReviews)
    .where(
      and(
        inArray(productReviews.productId, productIds),
        eq(productReviews.isDeleted, false),
        eq(productReviews.isHidden, false),
      ),
    )
    .groupBy(productReviews.productId);

  for (const r of rows) {
    const count = Number(r.count ?? 0);
    const avg = count > 0 ? Math.round(Number(r.avg ?? 0) * 10) / 10 : 0;
    result.set(r.productId, { count, avgRating: avg });
  }
  return result;
}

export function computeReviewStats(ratings: number[]): ProductReviewStats {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of ratings) {
    if (r >= 1 && r <= 5) {
      distribution[r as 1 | 2 | 3 | 4 | 5] += 1;
      sum += r;
    }
  }
  const reviewCount = ratings.length;
  const avgRating = reviewCount > 0 ? Math.round((sum / reviewCount) * 10) / 10 : 0;
  return { reviewCount, avgRating, distribution };
}
