const USER_UPLOAD_PREFIX = "/api/uploads/";
const ADMIN_UPLOAD_PREFIX = "/admin/api/uploads/";

const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const VIDEO_EXT_PATTERN = /\.(mp4|mov|webm)(?:[?#].*)?$/i;
const IMAGE_EXT_PATTERN = /\.(webp|png|jpe?g|gif)(?:[?#].*)?$/i;

/**
 * 관리자 콘솔(path="/admin" 쿠키 격리)에서 업로드 미디어를 안전하게 로드하기 위한 경로 변환
 */
export function toAdminUploadUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith(USER_UPLOAD_PREFIX)) {
    return `${ADMIN_UPLOAD_PREFIX}${url.slice(USER_UPLOAD_PREFIX.length)}`;
  }
  return url;
}

/**
 * DB 저장용 표준 업로드 경로(/api/uploads/...)로 정규화
 */
export function toCanonicalUploadUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith(ADMIN_UPLOAD_PREFIX)) {
    return `${USER_UPLOAD_PREFIX}${url.slice(ADMIN_UPLOAD_PREFIX.length)}`;
  }
  return url;
}

export function rewriteHtmlForAdminUploads(html?: string | null): string {
  if (!html) return "";
  return html.replaceAll(`"${USER_UPLOAD_PREFIX}`, `"${ADMIN_UPLOAD_PREFIX}`).replaceAll(
    `'${USER_UPLOAD_PREFIX}`,
    `'${ADMIN_UPLOAD_PREFIX}`,
  );
}

export function normalizeHtmlCanonicalUploads(html?: string | null): string {
  if (!html) return "";
  return html.replaceAll(ADMIN_UPLOAD_PREFIX, USER_UPLOAD_PREFIX);
}

/**
 * YouTube URL(watch, youtu.be, shorts, embed) 또는 11자리 ID에서 Video ID를 추출한다.
 */
export function extractYoutubeVideoId(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (YOUTUBE_ID_PATTERN.test(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
      return YOUTUBE_ID_PATTERN.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const vParam = parsed.searchParams.get("v");
      if (vParam && YOUTUBE_ID_PATTERN.test(vParam)) return vParam;

      const segments = parsed.pathname.split("/").filter(Boolean);
      if (
        segments.length >= 2 &&
        (segments[0] === "embed" || segments[0] === "shorts" || segments[0] === "live")
      ) {
        const candidate = segments[1] ?? "";
        return YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function isVideoMediaUrl(url?: string | null): boolean {
  if (!url) return false;
  return VIDEO_EXT_PATTERN.test(url.trim());
}

export function isImageMediaUrl(url?: string | null): boolean {
  if (!url) return false;
  return IMAGE_EXT_PATTERN.test(url.trim());
}
