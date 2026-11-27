"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { uploadMediaFile } from "@/00_lib/uploadClient";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { useSubmitLock } from "@/02_hooks/useSubmitLock";
import { upsertDogAction } from "@/03_actions/web/dogDailyActions";
import { DogAvatar } from "@/components/web/WebUiKit";
import {
  AppButton,
  AppCheckbox,
  AppDatePicker,
  AppInput,
  AppSegmented,
  AppSelectPicker,
} from "@/components/web/ui";

interface BreedOption {
  id: number;
  nameKo: string;
  defaultSize: "SMALL" | "MEDIUM" | "LARGE";
}

export interface EditableDogProfile {
  id: number;
  name: string;
  birthDate: string;
  breedId: number | null;
  sizeClass: "SMALL" | "MEDIUM" | "LARGE";
  gender: "MALE" | "FEMALE";
  neutered: boolean;
  weightKg: string | null;
  profileImage: string | null;
}

const SIZE_LABEL: Record<"SMALL" | "MEDIUM" | "LARGE", string> = {
  SMALL: "소형견",
  MEDIUM: "중형견",
  LARGE: "대형견",
};

export function DogProfileFormClient({
  breeds,
  initialDog,
  redirectAfter = "/app/onboarding/survey",
  submitLabel = "저장하고 맞춤 설문 시작",
  hidePhotoUpload = false,
  onSuccess,
}: {
  breeds: BreedOption[];
  initialDog?: EditableDogProfile;
  redirectAfter?: string;
  submitLabel?: string;
  hidePhotoUpload?: boolean;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const { pending: isPending, run: runLocked } = useSubmitLock();

  const [name, setName] = useState(initialDog?.name ?? "");
  const [birthDate, setBirthDate] = useState(initialDog?.birthDate ?? "2025-06-01");
  const [breedId, setBreedId] = useState<string>(
    initialDog?.breedId != null
      ? String(initialDog.breedId)
      : breeds[0]
        ? String(breeds[0].id)
        : "",
  );
  const [sizeClass, setSizeClass] = useState<"SMALL" | "MEDIUM" | "LARGE">(
    initialDog?.sizeClass ?? "SMALL",
  );
  const [gender, setGender] = useState<"MALE" | "FEMALE">(initialDog?.gender ?? "MALE");
  const [neutered, setNeutered] = useState(initialDog?.neutered ?? false);
  const [weightKg, setWeightKg] = useState(initialDog?.weightKg ?? (initialDog ? "" : "4.5"));
  const [profileImage, setProfileImage] = useState<string | null>(initialDog?.profileImage ?? null);
  const [isUploading, setIsUploading] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const breedOptions = useMemo(
    () =>
      breeds.map((b) => ({
        value: String(b.id),
        label: b.nameKo,
        sub: SIZE_LABEL[b.defaultSize],
      })),
    [breeds],
  );

  const handleWeightChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    const normalized =
      parts.length === 2 ? `${parts[0]!.slice(0, 2)}.${parts[1]!.slice(0, 1)}` : cleaned.slice(0, 2);
    setWeightKg(normalized);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await uploadMediaFile("/api/upload?category=dogs", file);
      if (!result.ok) {
        openAlert({
          title: "사진 업로드 실패",
          description: result.error,
          tone: "destructive",
        });
        return;
      }
      setProfileImage(result.url);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;
    if (!name.trim()) {
      openAlert({
        title: "반려견 이름을 입력해 주세요",
        onConfirm: () => setTimeout(() => nameRef.current?.focus(), 80),
      });
      return;
    }

    await runLocked(async () => {
      const res = await upsertDogAction({
        dogId: initialDog?.id,
        name,
        birthDate,
        breedId: breedId ? Number(breedId) : null,
        sizeClass,
        gender,
        neutered,
        weightKg,
        profileImage,
      });
      if (!res.ok) {
        openAlert({ title: "저장 실패", description: res.error.message, tone: "destructive" });
        return;
      }
      if (onSuccess) {
        onSuccess();
        router.refresh();
        openAlert({
          title: initialDog ? "반려견 정보가 수정되었습니다" : "새 반려견이 등록되었습니다",
        });
      } else {
        router.push(redirectAfter);
        router.refresh();
      }
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5">
      {/* 원형 반려견 프로필 사진 업로더 (온보딩 최초 등록에서는 생략, 내 반려견 관리에서 등록/수정) */}
      {!hidePhotoUpload && (
      <div className="flex flex-col items-center pt-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoSelect}
          disabled={isUploading || isPending}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isPending}
          aria-label={profileImage ? "반려견 프로필 사진 변경" : "반려견 프로필 사진 추가"}
          className="group relative waggle-squircle transition-transform duration-150 active:scale-[0.96] disabled:opacity-60"
        >
          <DogAvatar src={profileImage} name={name.trim() || "반려견"} size="xl" />
          {isUploading ? (
            <span className="absolute inset-0 flex items-center justify-center waggle-squircle bg-black/45 text-white">
              <Loader2 className="size-6 animate-spin" strokeWidth={2} />
            </span>
          ) : (
            <span className="absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full bg-ink text-surface ring-2 ring-surface transition-transform duration-150 group-hover:scale-105">
              <Camera className="size-4" strokeWidth={2} />
            </span>
          )}
        </button>

        <div className="mt-2.5 flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isPending}
            className="font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            {profileImage ? "사진 변경" : "사진 추가"}
          </button>
          {profileImage && (
            <>
              <span aria-hidden="true" className="text-border-subtle">
                |
              </span>
              <button
                type="button"
                onClick={() => setProfileImage(null)}
                disabled={isUploading || isPending}
                className="font-semibold text-destructive/85 transition-colors hover:text-destructive"
              >
                기본 이미지로
              </button>
            </>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-muted">최대 15MB 이하 사진</p>
      </div>
      )}

      <AppInput
        ref={nameRef}
        id="dog-name"
        label="반려견 이름 *"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        clearable
        onClear={() => setName("")}
        placeholder="예: 보리"
      />

      <div className="grid grid-cols-2 gap-4">
        <AppDatePicker
          label="생년월일 *"
          modalTitle="반려견 생년월일"
          value={birthDate}
          onChange={setBirthDate}
        />
        <AppInput
          id="dog-weight"
          label="체중"
          type="text"
          inputMode="decimal"
          value={weightKg}
          onChange={(e) => handleWeightChange(e.target.value)}
          placeholder="4.5"
          suffix="kg"
          className="tabular-nums"
        />
      </div>

      <AppSelectPicker
        label="견종"
        modalTitle="견종 선택"
        value={breedId}
        onChange={(nextVal) => {
          setBreedId(nextVal);
          const found = breeds.find((b) => String(b.id) === nextVal);
          if (found) setSizeClass(found.defaultSize);
        }}
        options={breedOptions}
        searchable
        searchPlaceholder="견종명 검색 (예: 푸들, 말티즈)"
      />

      <AppSegmented
        label="크기"
        value={sizeClass}
        onChange={setSizeClass}
        options={[
          { value: "SMALL", label: "소형견" },
          { value: "MEDIUM", label: "중형견" },
          { value: "LARGE", label: "대형견" },
        ]}
      />

      <AppSegmented
        label="성별"
        value={gender}
        onChange={setGender}
        options={[
          { value: "MALE", label: "남아" },
          { value: "FEMALE", label: "여아" },
        ]}
      />

      <div className="border-t border-border-subtle pt-2">
        <AppCheckbox
          checked={neutered}
          onChange={setNeutered}
          label="중성화 완료"
          description="맞춤 행동 매칭 참고 정보로만 사용됩니다."
        />
      </div>

      <AppButton type="submit" variant="primary" size="lg" fullWidth loading={isPending}>
        {submitLabel}
      </AppButton>
    </form>
  );
}
