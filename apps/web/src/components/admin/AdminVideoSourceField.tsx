"use client";

import { useMemo, useRef, useState } from "react";
import { Film, Upload, X, Youtube } from "lucide-react";
import {
  extractYoutubeVideoId,
  isImageMediaUrl,
  isVideoMediaUrl,
  toCanonicalUploadUrl,
} from "@/00_lib/mediaUrl";
import {
  formatFileSize,
  MAX_UPLOAD_IMAGE_BYTES,
  MAX_UPLOAD_LESSON_VIDEO_BYTES,
  MAX_UPLOAD_VIDEO_BYTES,
  uploadMediaFile,
  type UploadProgressInfo,
} from "@/00_lib/uploadClient";
import { useAdminAlertStore } from "@/01_store/admin/useAdminAlertStore";
import { AdminMediaPlayer } from "@/components/admin/AdminMediaPlayer";

type SourceMode = "YOUTUBE" | "UPLOAD";

export interface AdminVideoSourceFieldProps {
  /** 업로드 URL 또는 단일 미디어 URL을 제출할 hidden input name */
  videoUrlName: string;
  /** 교육 레슨처럼 YouTube ID 컬럼이 별도일 때 지정 (미지정 시 YouTube URL을 videoUrlName으로 제출) */
  youtubeIdName?: string;
  uploadCategory: "lessons" | "inquiries";
  initialVideoUrl?: string | null;
  initialYoutubeId?: string | null;
  allowImage?: boolean;
  label?: string;
}

export function AdminVideoSourceField({
  videoUrlName,
  youtubeIdName,
  uploadCategory,
  initialVideoUrl,
  initialYoutubeId,
  allowImage = false,
  label = "영상 소스 (YouTube 또는 파일 직접 업로드)",
}: AdminVideoSourceFieldProps) {
  const openAlert = useAdminAlertStore((s) => s.openAlert);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initialIsUploadedFile = Boolean(
    initialVideoUrl && (isVideoMediaUrl(initialVideoUrl) || isImageMediaUrl(initialVideoUrl)),
  );
  const initialYt =
    initialYoutubeId ?? (!initialIsUploadedFile ? extractYoutubeVideoId(initialVideoUrl) : null);

  const [mode, setMode] = useState<SourceMode>(initialIsUploadedFile ? "UPLOAD" : "YOUTUBE");
  const [youtubeInput, setYoutubeInput] = useState(initialYt ?? "");
  const [uploadedFile, setUploadedFile] = useState<{
    url: string;
    name: string;
    size: number | null;
  } | null>(
    initialIsUploadedFile && initialVideoUrl
      ? {
          url: toCanonicalUploadUrl(initialVideoUrl),
          name: initialVideoUrl.split("/").pop() ?? "업로드 파일",
          size: null,
        }
      : null,
  );
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgressInfo | null>(null);

  const parsedYoutubeId = useMemo(() => extractYoutubeVideoId(youtubeInput), [youtubeInput]);
  const maxVideoBytes =
    uploadCategory === "lessons" ? MAX_UPLOAD_LESSON_VIDEO_BYTES : MAX_UPLOAD_VIDEO_BYTES;
  const maxVideoMb = Math.round(maxVideoBytes / (1024 * 1024));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);
    const maxBytes = isVideo || !allowImage ? maxVideoBytes : MAX_UPLOAD_IMAGE_BYTES;

    setUploading(true);
    setProgress({ percent: 0, loaded: 0, total: file.size });
    try {
      const result = await uploadMediaFile(
        `/admin/api/upload?category=${uploadCategory}`,
        file,
        maxBytes,
        (info) => setProgress(info),
      );
      if (!result.ok) {
        openAlert({ title: "업로드 실패", description: result.error, tone: "negative" });
        return;
      }
      setUploadedFile({
        url: toCanonicalUploadUrl(result.url),
        name: result.name,
        size: result.size,
      });
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  // 제출값 계산
  const submittedYoutubeId = mode === "YOUTUBE" ? (parsedYoutubeId ?? "") : "";
  const submittedVideoUrl =
    mode === "UPLOAD"
      ? (uploadedFile?.url ?? "")
      : youtubeIdName
        ? ""
        : parsedYoutubeId
          ? `https://youtu.be/${parsedYoutubeId}`
          : "";

  return (
    <div className="space-y-2 rounded-control bg-base-1 p-3 atlas-border">
      {youtubeIdName && <input type="hidden" name={youtubeIdName} value={submittedYoutubeId} />}
      <input type="hidden" name={videoUrlName} value={submittedVideoUrl} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-neutral">{label}</span>
        <div className="inline-flex rounded-btn-sm bg-base-2 p-0.5 atlas-border">
          <button
            type="button"
            onClick={() => setMode("YOUTUBE")}
            className={`inline-flex h-6 items-center gap-1 rounded-badge px-2 text-xs font-medium transition-colors ${
              mode === "YOUTUBE"
                ? "bg-inverse text-on-inverse"
                : "text-secondary hover:text-neutral"
            }`}
          >
            <Youtube className="size-3.5" />
            YouTube 링크
          </button>
          <button
            type="button"
            onClick={() => setMode("UPLOAD")}
            className={`inline-flex h-6 items-center gap-1 rounded-badge px-2 text-xs font-medium transition-colors ${
              mode === "UPLOAD"
                ? "bg-inverse text-on-inverse"
                : "text-secondary hover:text-neutral"
            }`}
          >
            <Film className="size-3.5" />
            파일 업로드
          </button>
        </div>
      </div>

      {mode === "YOUTUBE" ? (
        <div key="youtube-panel" className="space-y-2">
          <input
            key="youtube-input"
            type="text"
            value={youtubeInput}
            onChange={(e) => setYoutubeInput(e.target.value)}
            placeholder="YouTube URL (youtu.be/... 또는 watch?v=...) 또는 11자리 ID"
            className="h-7 w-full rounded-control bg-base-2 px-2.5 font-mono text-xs text-neutral atlas-border"
          />
          {youtubeInput.trim() && (
            parsedYoutubeId ? (
              <div className="space-y-1.5">
                <p className="font-mono text-xs text-positive">
                  YouTube ID 인식됨: {parsedYoutubeId}
                </p>
                <AdminMediaPlayer youtubeVideoId={parsedYoutubeId} compact />
              </div>
            ) : (
              <p className="text-xs text-negative">유효한 YouTube URL 또는 11자리 ID가 아닙니다.</p>
            )
          )}
        </div>
      ) : (
        <div key="upload-panel" className="space-y-2">
          <input
            key="upload-file-input"
            ref={fileInputRef}
            type="file"
            accept={allowImage ? "video/mp4,video/quicktime,video/webm,image/*" : "video/mp4,video/quicktime,video/webm"}
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />

          {uploading && progress ? (
            <div className="space-y-1.5 rounded-btn-sm bg-base-2 p-2.5 atlas-border">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-neutral">업로드 중...</span>
                <span className="font-mono tabular-nums text-info">
                  {progress.percent}% ({formatFileSize(progress.loaded)} /{" "}
                  {formatFileSize(progress.total)})
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-1">
                <div
                  className="h-full rounded-full bg-info transition-[width] duration-150"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          ) : uploadedFile ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 rounded-btn-sm bg-base-2 px-2.5 py-1.5 atlas-border">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-medium text-neutral">
                    {uploadedFile.name}
                  </p>
                  <p className="text-xs text-subdued tabular-nums">
                    {uploadedFile.size !== null ? `${formatFileSize(uploadedFile.size)} · ` : ""}
                    업로드 완료
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-6 rounded-btn-sm px-2 text-xs text-secondary atlas-border hover:text-neutral"
                  >
                    교체
                  </button>
                  <button
                    type="button"
                    aria-label="업로드 파일 삭제"
                    onClick={() => setUploadedFile(null)}
                    className="inline-flex size-6 items-center justify-center rounded-btn-sm text-negative atlas-border"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
              <AdminMediaPlayer url={uploadedFile.url} compact />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-control bg-base-2 text-xs font-medium text-neutral atlas-border hover:bg-[var(--mix-hover-subtle)]"
            >
              <Upload className="size-3.5 text-secondary" />
              {allowImage ? "영상 또는 이미지 파일 선택" : "영상 파일 선택 (MP4 · MOV · WebM)"}
            </button>
          )}

          <p className="text-xs text-subdued">
            {allowImage
              ? `영상(MP4·MOV·WebM) 최대 ${maxVideoMb}MB · 이미지 최대 15MB (초과 시 YouTube 링크 탭 사용)`
              : `MP4 · MOV · WebM 최대 ${maxVideoMb}MB (장시간 고화질 강의는 YouTube 일부공개 링크 권장)`}
          </p>
        </div>
      )}
    </div>
  );
}
