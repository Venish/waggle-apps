import "server-only";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { getServerEnv } from "./env";

export type UploadCategory =
  | "products"
  | "editor"
  | "reviews"
  | "inquiries"
  | "dogs"
  | "daily"
  | "lessons";

const UPLOAD_CATEGORIES: readonly UploadCategory[] = [
  "products",
  "editor",
  "reviews",
  "inquiries",
  "dogs",
  "daily",
  "lessons",
];

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_INQUIRY_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB (1:1 행동 영상)
const MAX_LESSON_VIDEO_BYTES = 150 * 1024 * 1024; // 150MB (교육 강의 영상)
const MAX_IMAGE_WIDTH = 1200;
const DOG_AVATAR_SIZE = 600;

const VIDEO_EXT_MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

const ISO_BMFF_ATOMS = new Set(["ftyp", "moov", "mdat", "wide", "free", "skip"]);

const SERVE_MIME_BY_EXT: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

/**
 * 영상 파일 Magic Bytes 시그니처 검증 (확장자 위장 악성 파일 차단)
 * - MP4/MOV: ISO BMFF / QuickTime 컨테이너 4바이트 Atom(ftyp/moov/mdat/wide/free/skip) 확인
 * - WebM: EBML 헤더(1A 45 DF A3) 확인
 */
function hasValidVideoSignature(buf: Buffer, ext: string): boolean {
  if (ext === ".webm") {
    return (
      buf.byteLength >= 4 &&
      buf[0] === 0x1a &&
      buf[1] === 0x45 &&
      buf[2] === 0xdf &&
      buf[3] === 0xa3
    );
  }
  if (ext === ".mp4" || ext === ".mov") {
    if (buf.byteLength < 12) return false;
    const atom = buf.subarray(4, 8).toString("ascii");
    return ISO_BMFF_ATOMS.has(atom);
  }
  return false;
}

/**
 * 모노레포 루트 기준 일관된 UPLOAD_DIR 해석
 * - UPLOAD_DIR이 절대경로면 그대로 사용 (운영 NAS/볼륨 마운트 대응)
 * - 상대경로면 실행 위치(apps/web vs 모노레포 루트)에 무관하게 모노레포 루트 기준으로 해석
 */
export function resolveUploadRootDir(): string {
  const { UPLOAD_DIR } = getServerEnv();
  if (path.isAbsolute(UPLOAD_DIR)) {
    return path.resolve(UPLOAD_DIR);
  }
  const cwd = process.cwd();
  const repoRoot =
    path.basename(cwd) === "web" && path.basename(path.dirname(cwd)) === "apps"
      ? path.resolve(cwd, "../..")
      : cwd;
  return path.resolve(repoRoot, UPLOAD_DIR);
}

export function getUploadPublicBaseUrl(): string {
  const { UPLOAD_PUBLIC_BASE_URL } = getServerEnv();
  return UPLOAD_PUBLIC_BASE_URL.replace(/\/+$/, "");
}

function getYearMonthSegment(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

export async function saveUploadedFile(
  file: File,
  category: UploadCategory,
): Promise<{ url: string; size: number; contentType: string }> {
  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name).toLowerCase();
  const ym = getYearMonthSegment();
  const rootDir = resolveUploadRootDir();
  const targetDir = path.join(rootDir, category, ym);
  await fs.mkdir(targetDir, { recursive: true });

  // inquiries(50MB) / lessons(150MB) 카테고리는 영상 업로드 허용 (용량 + Magic Bytes 검증 필수)
  if ((category === "inquiries" || category === "lessons") && ext in VIDEO_EXT_MIME) {
    const maxVideoBytes = category === "lessons" ? MAX_LESSON_VIDEO_BYTES : MAX_INQUIRY_VIDEO_BYTES;
    if (rawBuffer.byteLength > maxVideoBytes) {
      throw new Error("FILE_TOO_LARGE");
    }
    if (!hasValidVideoSignature(rawBuffer, ext)) {
      throw new Error("INVALID_VIDEO");
    }
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    await fs.writeFile(path.join(targetDir, filename), rawBuffer);
    return {
      url: `${getUploadPublicBaseUrl()}/${category}/${ym}/${filename}`,
      size: rawBuffer.byteLength,
      contentType: VIDEO_EXT_MIME[ext] ?? "application/octet-stream",
    };
  }

  if (category === "lessons") {
    throw new Error("INVALID_VIDEO");
  }

  // 모든 이미지 업로드는 sharp로 강제 디코딩 + EXIF 제거 + WebP 리사이즈 (확장자 위장/XSS 원천 차단)
  if (rawBuffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }

  let optimized: Buffer;
  try {
    const pipeline = sharp(rawBuffer).rotate();
    optimized =
      category === "dogs"
        ? await pipeline
            .resize(DOG_AVATAR_SIZE, DOG_AVATAR_SIZE, {
              fit: "cover",
              position: "attention",
              withoutEnlargement: true,
            })
            .webp({ quality: 84 })
            .toBuffer()
        : await pipeline
            .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();
  } catch {
    throw new Error("INVALID_IMAGE");
  }

  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.webp`;
  await fs.writeFile(path.join(targetDir, filename), optimized);

  return {
    url: `${getUploadPublicBaseUrl()}/${category}/${ym}/${filename}`,
    size: optimized.byteLength,
    contentType: "image/webp",
  };
}

export interface UploadedFileStat {
  filePath: string;
  contentType: string;
  size: number;
  category: string;
}

/**
 * 업로드 파일 경로 검증 + 메타데이터 조회 (메모리 전체 로드 없이 스트리밍 서빙 준비)
 */
export async function statUploadedFileSafe(segments: string[]): Promise<UploadedFileStat | null> {
  if (segments.length === 0 || segments.length > 5) return null;
  for (const seg of segments) {
    if (
      !seg ||
      seg === "." ||
      seg === ".." ||
      seg.includes("..") ||
      seg.includes("/") ||
      seg.includes("\\") ||
      seg.includes("\0") ||
      seg.startsWith(".")
    ) {
      return null;
    }
  }

  const rootDir = resolveUploadRootDir();
  const targetPath = path.resolve(rootDir, ...segments);
  const rootPrefix = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;
  if (!targetPath.startsWith(rootPrefix)) {
    return null;
  }

  const ext = path.extname(targetPath).toLowerCase();
  const contentType = SERVE_MIME_BY_EXT[ext];
  if (!contentType) return null;

  try {
    const stat = await fs.stat(targetPath);
    if (!stat.isFile()) return null;
    return {
      filePath: targetPath,
      contentType,
      size: stat.size,
      category: segments[0] ?? "",
    };
  } catch {
    return null;
  }
}

function parseByteRange(
  rangeHeader: string,
  totalSize: number,
): { start: number; end: number } | "invalid" {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return "invalid";

  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return "invalid";

  if (rawStart === "") {
    // Suffix range: bytes=-500 (마지막 500바이트)
    const suffixLength = Number(rawEnd);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return "invalid";
    const start = Math.max(0, totalSize - suffixLength);
    return { start, end: totalSize - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd === "" ? totalSize - 1 : Math.min(Number(rawEnd), totalSize - 1);

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    start >= totalSize ||
    end < start
  ) {
    return "invalid";
  }

  return { start, end };
}

/**
 * Node ReadStream 기반 업로드 파일 스트리밍 + HTTP Range(206 Partial Content) 응답 생성기
 * - iOS Safari <video> 재생·탐색 필수 규격(Accept-Ranges + 206) 준수
 * - 대용량 영상 동시 조회 시 Node 힙 메모리 급증 방지
 */
export function createUploadStreamResponse(
  request: NextRequest,
  file: UploadedFileStat,
  options?: { isPrivate?: boolean; maxAgeSeconds?: number },
): NextResponse {
  const maxAge = options?.maxAgeSeconds ?? (options?.isPrivate ? 3600 : 31536000);
  const cacheControl = options?.isPrivate
    ? `private, max-age=${maxAge}`
    : `public, max-age=${maxAge}, immutable`;

  const baseHeaders: Record<string, string> = {
    "Content-Type": file.contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
  };

  const rangeHeader = request.headers.get("range");
  if (rangeHeader && file.size > 0) {
    const parsed = parseByteRange(rangeHeader, file.size);
    if (parsed === "invalid") {
      return new NextResponse(null, {
        status: 416,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes */${file.size}`,
        },
      });
    }

    const { start, end } = parsed;
    const chunkSize = end - start + 1;
    const stream = Readable.toWeb(
      createReadStream(file.filePath, { start, end }),
    ) as ReadableStream<Uint8Array>;

    return new NextResponse(stream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${file.size}`,
        "Content-Length": String(chunkSize),
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(file.filePath)) as ReadableStream<Uint8Array>;
  return new NextResponse(stream, {
    status: 200,
    headers: {
      ...baseHeaders,
      "Content-Length": String(file.size),
    },
  });
}

export interface CleanupCandidateFile {
  filePath: string;
  publicUrl: string;
  category: UploadCategory;
  size: number;
  mtimeMs: number;
}

/**
 * 고아 파일 정리 크론용: 지정 경과 시간(minAgeMs) 이상 된 업로드 파일 목록 스캔
 */
export async function listUploadedFilesOlderThan(
  minAgeMs: number,
): Promise<CleanupCandidateFile[]> {
  const rootDir = resolveUploadRootDir();
  const baseUrl = getUploadPublicBaseUrl();
  const cutoffMs = Date.now() - minAgeMs;
  const results: CleanupCandidateFile[] = [];

  for (const category of UPLOAD_CATEGORIES) {
    const catDir = path.join(rootDir, category);
    let ymEntries: string[];
    try {
      ymEntries = await fs.readdir(catDir);
    } catch {
      continue;
    }

    for (const ym of ymEntries) {
      if (ym.startsWith(".")) continue;
      const ymDir = path.join(catDir, ym);
      let fileNames: string[];
      try {
        fileNames = await fs.readdir(ymDir);
      } catch {
        continue;
      }

      for (const fileName of fileNames) {
        if (fileName.startsWith(".")) continue;
        const filePath = path.join(ymDir, fileName);
        try {
          const stat = await fs.stat(filePath);
          if (!stat.isFile() || stat.mtimeMs > cutoffMs) continue;
          results.push({
            filePath,
            publicUrl: `${baseUrl}/${category}/${ym}/${fileName}`,
            category,
            size: stat.size,
            mtimeMs: stat.mtimeMs,
          });
        } catch {
          // 스캔 중 삭제된 파일은 무시
        }
      }
    }
  }

  return results;
}
