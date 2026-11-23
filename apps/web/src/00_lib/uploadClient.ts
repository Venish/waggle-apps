export const MAX_UPLOAD_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB
export const MAX_UPLOAD_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB (1:1 Q&A 영상)
export const MAX_UPLOAD_LESSON_VIDEO_BYTES = 150 * 1024 * 1024; // 150MB (교육 강의 영상)

export type UploadClientResult =
  | { ok: true; url: string; name: string; size: number }
  | { ok: false; error: string };

export interface UploadProgressInfo {
  percent: number;
  loaded: number;
  total: number;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadApiPayload {
  ok?: boolean;
  data?: { url?: string; name?: string; size?: number };
  error?: string;
}

function parseServerResponse(
  status: number,
  rawText: string,
  fallbackFile: File,
): UploadClientResult {
  if (status === 413) {
    return {
      ok: false,
      error: "파일 용량이 서버 허용 한도를 초과했습니다. 더 작은 파일이나 YouTube 링크를 이용해 주세요.",
    };
  }

  let json: UploadApiPayload | null = null;
  try {
    json = JSON.parse(rawText) as UploadApiPayload;
  } catch {
    json = null;
  }

  if (status < 200 || status >= 300 || !json?.ok || !json.data?.url) {
    return {
      ok: false,
      error: json?.error ?? `파일 업로드에 실패했습니다. (HTTP ${status})`,
    };
  }

  return {
    ok: true,
    url: json.data.url,
    name: json.data.name ?? fallbackFile.name,
    size: json.data.size ?? fallbackFile.size,
  };
}

/**
 * 공용 미디어 업로드 클라이언트 래퍼 (사용자·관리자 공용)
 * - 클라이언트 용량 선체크(불필요한 대용량 전송 차단)
 * - 413/500/502 등 프록시 HTML 응답 시 JSON 파싱 예외 방어
 * - onProgress 전달 시 XMLHttpRequest로 실시간 업로드 진행률(%) 제공
 */
export async function uploadMediaFile(
  endpoint: string,
  file: File,
  maxBytes: number = MAX_UPLOAD_IMAGE_BYTES,
  onProgress?: (info: UploadProgressInfo) => void,
): Promise<UploadClientResult> {
  if (file.size > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);
    return {
      ok: false,
      error: isVideo
        ? `파일 용량(${formatFileSize(file.size)})이 최대 ${limitMb}MB를 초과했습니다. YouTube 링크로 첨부해 주세요.`
        : `파일 용량(${formatFileSize(file.size)})이 최대 ${limitMb}MB를 초과했습니다.`,
    };
  }

  const fd = new FormData();
  fd.append("file", file);

  if (onProgress) {
    return new Promise<UploadClientResult>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint, true);

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && ev.total > 0) {
          onProgress({
            percent: Math.min(99, Math.round((ev.loaded / ev.total) * 100)),
            loaded: ev.loaded,
            total: ev.total,
          });
        }
      };

      xhr.onload = () => {
        onProgress({ percent: 100, loaded: file.size, total: file.size });
        resolve(parseServerResponse(xhr.status, xhr.responseText, file));
      };

      xhr.onerror = () => {
        resolve({
          ok: false,
          error: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
        });
      };

      xhr.send(fd);
    });
  }

  try {
    const res = await fetch(endpoint, { method: "POST", body: fd });
    const text = await res.text();
    return parseServerResponse(res.status, text, file);
  } catch {
    return {
      ok: false,
      error: "네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
    };
  }
}
