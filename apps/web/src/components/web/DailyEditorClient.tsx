"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, X } from "lucide-react";
import { cn } from "@repo/ui";
import { MAX_UPLOAD_IMAGE_BYTES, uploadMediaFile } from "@/00_lib/uploadClient";
import { useSubmitLock } from "@/02_hooks/useSubmitLock";
import {
  deleteDailyEntryAction,
  saveDailyEntryAction,
} from "@/03_actions/web/dogDailyActions";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { DailyStickerIcon } from "@/components/web/DailyStickerIcon";
import {
  AppButton,
  AppCheckbox,
  AppFieldGroup,
  AppInput,
  AppTextarea,
} from "@/components/web/ui";

const MAX_DAILY_PHOTOS = 5;

const STICKER_OPTIONS = [
  { k: "POOP", l: "배변" },
  { k: "MEAL", l: "식사" },
  { k: "MEDICINE", l: "투약" },
  { k: "HOSPITAL", l: "병원" },
  { k: "WALK", l: "산책" },
  { k: "CUSTOM", l: "기타" },
] as const;

const STICKER_LABEL: Record<string, string> = {
  POOP: "배변",
  MEAL: "식사",
  MEDICINE: "투약",
  HOSPITAL: "병원",
  WALK: "산책",
  CUSTOM: "기타",
};

export interface DailyEditorStickerItem {
  id: number;
  kind: string;
  note: string | null;
  photoUrl: string | null;
}

export interface DailyEditorEntryInput {
  id: number;
  walked: boolean;
  weightKg: string | null;
  photoUrls: string[];
  memo: string | null;
  stickers: DailyEditorStickerItem[];
}

function formatWeightDisplay(val: string | null): string | null {
  if (!val) return null;
  const num = Number(val);
  if (!Number.isFinite(num)) return null;
  return Number.isInteger(num) ? num.toFixed(1) : Number(num.toFixed(2)).toString();
}

/**
 * 일상 기록 등록 · 수정 · 삭제 전용 에디터 (단일 시트/페이지 공용)
 * - 신규 기록: 하단 고정 Footer [일상 기록 저장]
 * - 기존 기록: 하단 고정 Footer [삭제] | [일상 기록 수정] (좌우 1:2)
 */
export function DailyEditorClient({
  dogId,
  entryDate,
  initialEntry,
  latestWeightKg,
  onSaved,
  redirectAfterComplete,
}: {
  dogId: number;
  entryDate: string;
  initialEntry?: DailyEditorEntryInput | null;
  latestWeightKg?: string | null;
  onSaved?: () => void;
  redirectAfterComplete?: string;
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const memoRef = useRef<HTMLTextAreaElement>(null);
  const isEdit = Boolean(initialEntry);
  const { pending, run } = useSubmitLock();

  const [walked, setWalked] = useState(initialEntry?.walked ?? false);
  const [weightKg, setWeightKg] = useState(
    formatWeightDisplay(initialEntry?.weightKg ?? null) ?? "",
  );
  const [photoUrls, setPhotoUrls] = useState<string[]>(initialEntry?.photoUrls ?? []);
  const [memo, setMemo] = useState(initialEntry?.memo ?? "");
  const [removedStickerIds, setRemovedStickerIds] = useState<number[]>([]);
  const [stickerKind, setStickerKind] = useState<
    "" | "POOP" | "MEAL" | "MEDICINE" | "HOSPITAL" | "WALK" | "CUSTOM"
  >("");
  const [stickerNote, setStickerNote] = useState("");
  const [stickerPhotoUrl, setStickerPhotoUrl] = useState("");
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingSticker, setUploadingSticker] = useState(false);

  const visibleStickers = (initialEntry?.stickers ?? []).filter(
    (s) => !removedStickerIds.includes(s.id),
  );

  const handleMultiPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const remaining = MAX_DAILY_PHOTOS - photoUrls.length;
    if (remaining <= 0) {
      openAlert({
        title: `사진은 최대 ${MAX_DAILY_PHOTOS}장까지 첨부할 수 있습니다`,
      });
      e.target.value = "";
      return;
    }

    const files = Array.from(fileList).slice(0, remaining);
    if (fileList.length > remaining) {
      openAlert({
        title: `최대 ${MAX_DAILY_PHOTOS}장까지 첨부할 수 있어 앞의 ${remaining}장만 업로드합니다`,
      });
    }

    setUploadingPhotos(true);
    const uploaded: string[] = [];
    const errors: string[] = [];
    try {
      for (const file of files) {
        const res = await uploadMediaFile(
          "/api/upload?category=daily",
          file,
          MAX_UPLOAD_IMAGE_BYTES,
        );
        if (res.ok) {
          uploaded.push(res.url);
        } else {
          errors.push(res.error);
        }
      }
      if (uploaded.length > 0) {
        setPhotoUrls((prev) =>
          Array.from(new Set([...prev, ...uploaded])).slice(0, MAX_DAILY_PHOTOS),
        );
      }
      if (errors.length > 0) {
        openAlert({
          title: "일부 사진 업로드 실패",
          description: errors[0],
          tone: "destructive",
        });
      }
    } finally {
      setUploadingPhotos(false);
      e.target.value = "";
    }
  };

  const handleStickerPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSticker(true);
    try {
      const res = await uploadMediaFile(
        "/api/upload?category=daily",
        file,
        MAX_UPLOAD_IMAGE_BYTES,
      );
      if (!res.ok) {
        openAlert({ title: "업로드 실패", description: res.error, tone: "destructive" });
        return;
      }
      setStickerPhotoUrl(res.url);
    } finally {
      setUploadingSticker(false);
      e.target.value = "";
    }
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadingPhotos || uploadingSticker) return;

    const trimmedMemo = memo.trim();
    if (!trimmedMemo) {
      openAlert({
        title: "자유 일기를 입력해 주세요",
        description: "오늘 강아지와의 일상을 한 줄 이상 남겨 주세요.",
        onConfirm: () => {
          setTimeout(() => memoRef.current?.focus(), 0);
        },
      });
      return;
    }

    const trimmedWeight = weightKg.trim();
    if (trimmedWeight !== "") {
      const num = Number(trimmedWeight);
      if (!Number.isFinite(num) || num < 0.1 || num > 150) {
        openAlert({
          title: "체중 입력값을 확인해 주세요",
          description: "0.1kg ~ 150kg 범위의 숫자로 입력해 주세요.",
          tone: "destructive",
        });
        return;
      }
    }

    void run(async () => {
      const res = await saveDailyEntryAction({
        dogId,
        entryDate,
        walked,
        weightKg: trimmedWeight || null,
        photoUrls,
        memo: trimmedMemo,
        removeStickerIds: removedStickerIds.length > 0 ? removedStickerIds : undefined,
        stickerKind: stickerKind || undefined,
        stickerNote: stickerNote || undefined,
        stickerPhotoUrl: stickerPhotoUrl || undefined,
      });
      if (!res.ok) {
        openAlert({ title: "저장 실패", description: res.error.message, tone: "destructive" });
        return;
      }
      onSaved?.();
      if (redirectAfterComplete) {
        router.replace(redirectAfterComplete);
      } else {
        router.refresh();
      }
      openAlert({ title: isEdit ? "일상 기록이 수정되었습니다" : "일상 기록이 저장되었습니다" });
    });
  };

  const handleDeleteEntry = () => {
    if (!initialEntry || pending) return;
    openAlert({
      title: "이 날의 일상 기록을 삭제할까요?",
      description: "등록된 사진, 체중, 일기, 스티커가 함께 삭제됩니다.",
      tone: "destructive",
      confirmLabel: "삭제",
      cancelLabel: "취소",
      onConfirm: async () => {
        await run(async () => {
          const res = await deleteDailyEntryAction(initialEntry.id);
          if (!res.ok) {
            openAlert({
              title: "삭제 실패",
              description: res.error.message,
              tone: "destructive",
            });
            return;
          }
          onSaved?.();
          if (redirectAfterComplete) {
            router.replace(redirectAfterComplete);
          } else {
            router.refresh();
          }
          openAlert({ title: "일상 기록이 삭제되었습니다" });
        });
      },
    });
  };

  const hintWeight = formatWeightDisplay(latestWeightKg ?? null);

  return (
    <form noValidate onSubmit={handleSaveEntry} className="space-y-5">
      <div className="border-y border-border-subtle py-1">
        <AppCheckbox
          checked={walked}
          onChange={setWalked}
          label="오늘 산책 완료"
          description="산책 체크 시 일상 캘린더에 산책 완료 표시가 남습니다."
        />
      </div>

      {/* 체중 입력 */}
      <AppInput
        label="체중 (kg)"
        type="text"
        inputMode="decimal"
        value={weightKg}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^0-9.]/g, "");
          setWeightKg(cleaned);
        }}
        clearable
        onClear={() => setWeightKg("")}
        placeholder={hintWeight ? `예: ${hintWeight}` : "예: 4.5"}
        description="가장 최근 날짜에 기록한 체중은 반려견 프로필 체중에 자동 반영됩니다."
      />

      {/* 일상 다중 사진 업로드 (최대 5장) */}
      <AppFieldGroup
        label={`일상 사진 (${photoUrls.length}/${MAX_DAILY_PHOTOS})`}
        labelMeta="장당 15MB 이하"
      >
        <div className="grid grid-cols-3 gap-2">
          {photoUrls.map((url, idx) => (
            <div
              key={url}
              className="relative aspect-square overflow-hidden rounded-2xl bg-surface-subtle ring-1 ring-ink/[0.06]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`첨부 사진 ${idx + 1}`}
                className="size-full object-cover"
              />
              <button
                type="button"
                aria-label={`사진 ${idx + 1} 제거`}
                onClick={() => setPhotoUrls((prev) => prev.filter((u) => u !== url))}
                className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-ink/75 text-surface transition-transform active:scale-90"
              >
                <X className="size-3.5" strokeWidth={2.4} />
              </button>
            </div>
          ))}

          {photoUrls.length < MAX_DAILY_PHOTOS && (
            <button
              type="button"
              disabled={uploadingPhotos}
              onClick={() => photoInputRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border-subtle bg-surface-subtle text-ink-muted transition-colors hover:bg-ink/[0.05] active:scale-[0.98] disabled:opacity-50"
            >
              <Camera className="size-5 text-brand" strokeWidth={2} />
              <span className="text-xs font-semibold">
                {uploadingPhotos ? "업로드 중..." : "사진 추가"}
              </span>
            </button>
          )}
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleMultiPhotoUpload}
        />
      </AppFieldGroup>

      <AppTextarea
        ref={memoRef}
        label="자유 일기 *"
        rows={4}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="오늘 강아지와 있었던 일을 기록해 보세요."
      />

      {/* 기존 등록 스티커 관리 */}
      {visibleStickers.length > 0 && (
        <AppFieldGroup label={`등록된 스티커 (${visibleStickers.length})`}>
          <ul className="space-y-1.5">
            {visibleStickers.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2.5 rounded-xl bg-surface-subtle px-3 py-2.5 text-sm text-ink"
              >
                <DailyStickerIcon kind={s.kind} className="size-5" />
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-ink">{STICKER_LABEL[s.kind] ?? s.kind}</span>
                  <span className="ml-1.5 text-ink-muted">{s.note || "메모 없음"}</span>
                </div>
                {s.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.photoUrl}
                    alt=""
                    className="size-7 shrink-0 rounded-lg object-cover"
                  />
                )}
                <button
                  type="button"
                  aria-label="스티커 삭제"
                  onClick={() => setRemovedStickerIds((prev) => [...prev, s.id])}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-ink/10 hover:text-ink"
                >
                  <X className="size-3.5" strokeWidth={2.2} />
                </button>
              </li>
            ))}
          </ul>
        </AppFieldGroup>
      )}

      {/* 신규 스티커 추가 (6종 파스텔 컬러 아이콘 타일) */}
      <AppFieldGroup label="스티커 추가">
        <div className="grid grid-cols-3 gap-2">
          {STICKER_OPTIONS.map((st) => {
            const selected = stickerKind === st.k;
            return (
              <button
                key={st.k}
                type="button"
                aria-pressed={selected}
                onClick={() => setStickerKind(selected ? "" : st.k)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-2xl px-2.5 py-2.5 text-sm transition-all active:scale-[0.97]",
                  selected
                    ? "bg-brand-soft font-bold text-ink ring-1.5 ring-brand"
                    : "bg-surface-subtle font-medium text-ink hover:bg-ink/[0.05]",
                )}
              >
                <DailyStickerIcon kind={st.k} className="size-4.5" />
                <span>{st.l}</span>
              </button>
            );
          })}
        </div>

        {stickerKind && (
          <div className="mt-4 space-y-3">
            <AppInput
              label="스티커 메모"
              type="text"
              value={stickerNote}
              onChange={(e) => setStickerNote(e.target.value)}
              clearable
              onClear={() => setStickerNote("")}
              placeholder="예: 아침 사료 완식"
            />
            {stickerPhotoUrl ? (
              <div className="flex items-center gap-3 rounded-2xl bg-surface-subtle p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={stickerPhotoUrl}
                  alt="스티커 첨부 사진"
                  className="size-12 rounded-xl object-cover"
                />
                <span className="flex-1 text-xs font-semibold text-ink">스티커 사진 첨부됨</span>
                <button
                  type="button"
                  onClick={() => setStickerPhotoUrl("")}
                  className="flex size-7 items-center justify-center rounded-full bg-surface text-ink-muted"
                >
                  <X className="size-3.5" strokeWidth={2.2} />
                </button>
              </div>
            ) : (
              <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-surface-subtle text-xs font-semibold text-ink transition-colors hover:bg-ink/[0.06]">
                <Upload className="size-4 text-ink-muted" strokeWidth={2} />
                {uploadingSticker ? "사진 업로드 중..." : "스티커 사진 첨부"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleStickerPhotoUpload}
                />
              </label>
            )}
          </div>
        )}
      </AppFieldGroup>

      {/* 하단 고정 Footer: 신규 [저장] / 수정 [삭제 | 수정] */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-border-subtle bg-surface/95 px-4 pt-3 backdrop-blur-md pb-safe-bottom">
        {isEdit ? (
          <div className="grid grid-cols-[1fr_2fr] gap-2.5">
            <AppButton
              type="button"
              variant="danger"
              size="lg"
              fullWidth
              disabled={pending}
              onClick={handleDeleteEntry}
            >
              삭제
            </AppButton>
            <AppButton
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={pending || uploadingPhotos || uploadingSticker}
            >
              {pending ? "저장 중..." : "일상 기록 수정"}
            </AppButton>
          </div>
        ) : (
          <AppButton
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={pending || uploadingPhotos || uploadingSticker}
          >
            {pending ? "저장 중..." : "일상 기록 저장"}
          </AppButton>
        )}
      </div>
    </form>
  );
}
