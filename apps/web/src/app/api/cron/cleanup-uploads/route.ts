import fs from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import {
  banners,
  dailyEntries,
  dailyEntryStickers,
  dogs,
  getDb,
  inquiries,
  isNotNull,
  lessonSteps,
  productImages,
  productReviews,
  products,
  trainers,
  users,
} from "@repo/db";
import { getServerEnv } from "@/00_lib/env";
import { getUploadPublicBaseUrl, listUploadedFilesOlderThan } from "@/00_lib/uploadStorage";

const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000; // 생성 후 24시간 이상 경과한 미참조 파일만 정리

function isAuthorizedCron(request: NextRequest): boolean {
  const env = getServerEnv();
  const authHeader = request.headers.get("authorization");
  const secretHeader = request.headers.get("x-cron-secret");
  return authHeader === `Bearer ${env.CRON_SECRET}` || secretHeader === env.CRON_SECRET;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 업로드 스토리지 고아 파일(Orphan Files) 정기 정리 크론 배치
 * - 소프트 삭제(is_deleted = true) 행을 포함한 전체 DB 참조 URL을 수집해 복원 시 이미지 깨짐을 원천 차단
 * - 생성 후 24시간 이상 경과했고 DB 어느 곳에서도 참조하지 않는 파일만 안전하게 삭제
 * - `?dryRun=1` 전달 시 실제 삭제 없이 대상 건수·용량만 반환
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const db = getDb();
  const baseUrl = getUploadPublicBaseUrl();
  const htmlUrlRegex = new RegExp(`${escapeRegExp(baseUrl)}/[a-zA-Z0-9/_.-]+`, "g");

  const [
    candidates,
    prodImgRows,
    prodHtmlRows,
    reviewRows,
    dogRows,
    userRows,
    trainerRows,
    inquiryRows,
    bannerRows,
    lessonStepRows,
    dailyEntryRows,
    dailyStickerRows,
  ] = await Promise.all([
    listUploadedFilesOlderThan(ORPHAN_MIN_AGE_MS),
    db.select({ url: productImages.url }).from(productImages),
    db
      .select({ html: products.detailHtml })
      .from(products)
      .where(isNotNull(products.detailHtml)),
    db.select({ urls: productReviews.imageUrls }).from(productReviews),
    db
      .select({ url: dogs.profileImage })
      .from(dogs)
      .where(isNotNull(dogs.profileImage)),
    db
      .select({ url: users.profileImage })
      .from(users)
      .where(isNotNull(users.profileImage)),
    db
      .select({ url: trainers.profileImage })
      .from(trainers)
      .where(isNotNull(trainers.profileImage)),
    db
      .select({ videoUrl: inquiries.videoUrl, answerVideoUrl: inquiries.answerVideoUrl })
      .from(inquiries),
    db
      .select({ url: banners.imageUrl })
      .from(banners)
      .where(isNotNull(banners.imageUrl)),
    db
      .select({ url: lessonSteps.videoUrl })
      .from(lessonSteps)
      .where(isNotNull(lessonSteps.videoUrl)),
    db.select({ urls: dailyEntries.photoUrls }).from(dailyEntries),
    db
      .select({ url: dailyEntryStickers.photoUrl })
      .from(dailyEntryStickers)
      .where(isNotNull(dailyEntryStickers.photoUrl)),
  ]);

  const referencedUrls = new Set<string>();
  const addUrl = (url?: string | null) => {
    if (url && url.startsWith(baseUrl)) referencedUrls.add(url);
  };

  for (const r of prodImgRows) addUrl(r.url);
  for (const r of prodHtmlRows) {
    if (!r.html) continue;
    for (const match of r.html.matchAll(htmlUrlRegex)) {
      if (match[0]) referencedUrls.add(match[0]);
    }
  }
  for (const r of reviewRows) {
    if (!Array.isArray(r.urls)) continue;
    for (const u of r.urls) addUrl(u);
  }
  for (const r of dogRows) addUrl(r.url);
  for (const r of userRows) addUrl(r.url);
  for (const r of trainerRows) addUrl(r.url);
  for (const r of inquiryRows) {
    addUrl(r.videoUrl);
    addUrl(r.answerVideoUrl);
  }
  for (const r of bannerRows) addUrl(r.url);
  for (const r of lessonStepRows) addUrl(r.url);
  for (const r of dailyEntryRows) {
    if (!Array.isArray(r.urls)) continue;
    for (const u of r.urls) addUrl(u);
  }
  for (const r of dailyStickerRows) addUrl(r.url);

  const orphans = candidates.filter((c) => !referencedUrls.has(c.publicUrl));
  let deletedCount = 0;
  let freedBytes = 0;

  for (const item of orphans) {
    if (!dryRun) {
      try {
        await fs.unlink(item.filePath);
        deletedCount += 1;
        freedBytes += item.size;
      } catch {
        // 이미 삭제된 파일은 무시
      }
    } else {
      freedBytes += item.size;
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      scannedCount: candidates.length,
      referencedCount: referencedUrls.size,
      orphanCount: orphans.length,
      deletedCount,
      freedBytes,
      dryRun,
      executedAt: new Date().toISOString(),
    },
  });
}
