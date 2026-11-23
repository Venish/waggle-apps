"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Star, X } from "lucide-react";
import { WaggleMark } from "@repo/ui";
import { toAdminUploadUrl } from "@/00_lib/mediaUrl";
import { uploadMediaFile } from "@/00_lib/uploadClient";
import { useAdminAlertStore } from "@/01_store/admin/useAdminAlertStore";

interface AdminProductImageManagerProps {
  name: string;
  initialUrls?: string[];
  maxCount?: number;
}

export function AdminProductImageManager({
  name,
  initialUrls = [],
  maxCount = 10,
}: AdminProductImageManagerProps) {
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const openAlert = useAdminAlertStore((s) => s.openAlert);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const remaining = maxCount - urls.length;
    if (remaining <= 0) {
      openAlert({
        title: "최대 개수 초과",
        description: `상품 이미지는 최대 ${maxCount}장까지 등록할 수 있습니다.`,
        tone: "default",
      });
      return;
    }

    const targets = Array.from(fileList).slice(0, remaining);
    setUploading(true);
    const uploaded: string[] = [];

    try {
      for (const file of targets) {
        const result = await uploadMediaFile("/admin/api/upload?category=products", file);
        if (!result.ok) {
          openAlert({
            title: "이미지 업로드 실패",
            description: result.error,
            tone: "negative",
          });
          continue;
        }
        uploaded.push(result.url);
      }

      if (uploaded.length > 0) {
        setUrls((prev) => Array.from(new Set([...prev, ...uploaded])).slice(0, maxCount));
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const moveImage = (index: number, delta: -1 | 1) => {
    setUrls((prev) => {
      const nextIdx = index + delta;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(nextIdx, 0, moved!);
      return copy;
    });
  };

  const setPrimary = (index: number) => {
    if (index === 0) return;
    setUrls((prev) => {
      const copy = [...prev];
      const [picked] = copy.splice(index, 1);
      return [picked!, ...copy];
    });
  };

  const removeImage = (index: number) => {
    setUrls((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2.5">
      <input type="hidden" name={name} value={JSON.stringify(urls)} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-neutral">
            상품 이미지 ({urls.length} / {maxCount})
          </p>
          <p className="text-xs text-subdued">
            첫 번째 이미지가 대표 썸네일이며, 2장 이상 등록 시 모바일 상세에서 스와이퍼로 노출됩니다. (장당 최대 15MB · 자동 WebP 변환)
          </p>
        </div>
        <button
          type="button"
          disabled={uploading || urls.length >= maxCount}
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-7 items-center gap-1.5 rounded-control bg-base-1 px-2.5 text-xs font-medium text-neutral atlas-border hover:bg-[var(--mix-hover-subtle)] disabled:opacity-50"
        >
          <ImagePlus className="size-3.5" />
          {uploading ? "변환 · 업로드 중..." : "이미지 추가"}
        </button>
      </div>

      {urls.length === 0 ? (
        <div className="flex items-center gap-3 rounded-control bg-base-1 p-3 atlas-border">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-btn-sm bg-positive/15 text-positive">
            <WaggleMark className="h-6 w-auto" />
          </div>
          <div className="text-xs text-subdued leading-relaxed">
            등록된 이미지가 없습니다. 이미지가 없으면 사용자 화면에{" "}
            <strong className="font-medium text-neutral">와글 브랜드 컬러 + 로고 마크</strong>가
            자동으로 표시됩니다.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
          {urls.map((url, idx) => (
            <div
              key={url}
              className="group relative overflow-hidden rounded-control bg-base-1 atlas-border"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-base-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={toAdminUploadUrl(url)}
                  alt={`상품 이미지 ${idx + 1}`}
                  className="size-full object-cover"
                />
                {idx === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-badge bg-inverse px-1.5 py-0.5 text-xs font-semibold text-on-inverse">
                    대표
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  aria-label="이미지 제거"
                  className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-1 px-1.5 py-1 text-xs">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveImage(idx, -1)}
                    aria-label="앞으로 이동"
                    className="inline-flex size-6 items-center justify-center rounded-btn-sm text-secondary hover:bg-[var(--mix-hover-subtle)] disabled:opacity-30"
                  >
                    <ArrowLeft className="size-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === urls.length - 1}
                    onClick={() => moveImage(idx, 1)}
                    aria-label="뒤로 이동"
                    className="inline-flex size-6 items-center justify-center rounded-btn-sm text-secondary hover:bg-[var(--mix-hover-subtle)] disabled:opacity-30"
                  >
                    <ArrowRight className="size-3" />
                  </button>
                </div>
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => setPrimary(idx)}
                    className="inline-flex items-center gap-0.5 rounded-btn-sm px-1.5 py-0.5 text-xs text-secondary hover:bg-[var(--mix-hover-subtle)] hover:text-neutral"
                  >
                    <Star className="size-3" />
                    대표
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
