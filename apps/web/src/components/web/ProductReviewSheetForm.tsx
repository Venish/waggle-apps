"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Star, X } from "lucide-react";
import { PointIcon } from "@repo/ui";
import { uploadMediaFile } from "@/00_lib/uploadClient";
import { useSubmitLock } from "@/02_hooks/useSubmitLock";
import {
  createProductReviewAction,
  updateMyProductReviewAction,
} from "@/03_actions/web/walletShopActions";
import type { ShopReviewPolicy } from "@/04_services/shared/policyService";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { AppButton, AppTextarea } from "@/components/web/ui";

const RATING_LABELS: Record<number, string> = {
  1: "아쉬워요",
  2: "그저 그래요",
  3: "보통이에요",
  4: "만족해요",
  5: "아주 만족해요!",
};

export interface EligibleOrderItemChoice {
  orderItemId: number;
  orderNo: string;
  nameSnap: string;
}

export interface ProductReviewSheetFormProps {
  mode: "create" | "edit";
  productName: string;
  policy: ShopReviewPolicy;
  eligibleOrderItems?: EligibleOrderItemChoice[];
  existingReview?: {
    id: number;
    rating: number;
    content: string;
    imageUrls: string[];
  };
  onDone: () => void;
}

export function ProductReviewSheetForm({
  mode,
  productName,
  policy,
  eligibleOrderItems = [],
  existingReview,
  onDone,
}: ProductReviewSheetFormProps) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const { pending, run } = useSubmitLock();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedOrderItemId, setSelectedOrderItemId] = useState<number>(
    eligibleOrderItems[0]?.orderItemId ?? 0,
  );
  const [rating, setRating] = useState<number>(existingReview?.rating ?? 5);
  const [content, setContent] = useState<string>(existingReview?.content ?? "");
  const [imageUrls, setImageUrls] = useState<string[]>(existingReview?.imageUrls ?? []);
  const [uploading, setUploading] = useState(false);

  const expectedReward =
    imageUrls.length > 0 ? policy.photoRewardPoint : policy.textRewardPoint;
  const trimmedLength = content.trim().length;

  const handleUploadPhotos = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const remaining = 5 - imageUrls.length;
    if (remaining <= 0) {
      openAlert({
        title: "사진 첨부 한도",
        description: "후기 사진은 최대 5장까지 첨부할 수 있습니다.",
      });
      return;
    }

    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of Array.from(fileList).slice(0, remaining)) {
        const result = await uploadMediaFile("/api/upload?category=reviews", file);
        if (!result.ok) {
          openAlert({
            title: "사진 업로드 실패",
            description: result.error,
            tone: "destructive",
          });
          continue;
        }
        uploaded.push(result.url);
      }
      if (uploaded.length > 0) {
        setImageUrls((prev) => Array.from(new Set([...prev, ...uploaded])).slice(0, 5));
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading) return;

    if (trimmedLength < policy.minLength) {
      openAlert({
        title: "내용을 조금 더 작성해 주세요",
        description: `후기는 최소 ${policy.minLength}자 이상 작성해 주세요. (현재 ${trimmedLength}자)`,
      });
      return;
    }
    if (trimmedLength > policy.maxLength) {
      openAlert({
        title: "최대 글자수를 초과했어요",
        description: `후기는 최대 ${policy.maxLength}자 이하로 작성해 주세요.`,
      });
      return;
    }

    void run(async () => {
      if (mode === "edit" && existingReview) {
        const res = await updateMyProductReviewAction({
          reviewId: existingReview.id,
          rating,
          content: content.trim(),
          imageUrls,
        });
        if (!res.ok) {
          openAlert({ title: "후기 수정 실패", description: res.error.message, tone: "destructive" });
          return;
        }
        onDone();
        router.refresh();
        openAlert({
          title: "후기가 수정되었습니다",
          description: "변경된 내용과 사진이 상품 후기에 반영되었습니다.",
        });
        return;
      }

      const res = await createProductReviewAction({
        orderItemId: selectedOrderItemId,
        rating,
        content: content.trim(),
        imageUrls,
      });
      if (!res.ok) {
        openAlert({ title: "후기 등록 실패", description: res.error.message, tone: "destructive" });
        return;
      }
      onDone();
      router.refresh();
      openAlert({
        title: "소중한 후기가 등록되었습니다",
        description:
          res.data.rewardPoint > 0
            ? `감사 포인트 ${res.data.rewardPoint.toLocaleString("ko-KR")}P가 지갑에 즉시 적립되었습니다.`
            : "작성해 주신 후기가 상품 상세에 반영되었습니다.",
      });
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-2xl bg-surface-subtle px-4 py-3">
        <p className="text-xs font-medium text-ink-muted">대상 상품</p>
        <p className="mt-0.5 text-sm font-bold text-ink">{productName}</p>
        {mode === "create" && eligibleOrderItems.length > 1 && (
          <select
            value={selectedOrderItemId}
            onChange={(e) => setSelectedOrderItemId(Number(e.target.value))}
            className="mt-2 h-9 w-full rounded-xl border border-border-subtle bg-surface px-3 text-xs font-medium text-ink"
          >
            {eligibleOrderItems.map((it) => (
              <option key={it.orderItemId} value={it.orderItemId}>
                [{it.orderNo}] {it.nameSnap}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 별점 선택 */}
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold text-ink-muted">상품은 만족하셨나요?</p>
        <div className="flex items-center justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((score) => {
            const active = score <= rating;
            return (
              <button
                key={score}
                type="button"
                aria-label={`${score}점`}
                onClick={() => setRating(score)}
                className="p-1 transition-transform active:scale-90"
              >
                <Star
                  className={`size-8 transition-colors ${
                    active ? "fill-star text-star" : "text-border-subtle"
                  }`}
                  strokeWidth={1.6}
                />
              </button>
            );
          })}
        </div>
        <p className="text-sm font-bold text-ink">
          {rating}점 · {RATING_LABELS[rating]}
        </p>
      </div>

      {/* 적립 예정 포인트 배너 */}
      {mode === "create" && (policy.textRewardPoint > 0 || policy.photoRewardPoint > 0) && (
        <div className="flex items-center justify-between rounded-2xl bg-brand-soft px-4 py-3 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-brand-strong">
            <PointIcon className="size-4 shrink-0" />
            {imageUrls.length > 0 ? "포토 후기 적립 예정" : "텍스트 후기 적립 예정"}
          </span>
          <strong className="text-sm font-extrabold tabular-nums text-brand-strong">
            +{expectedReward.toLocaleString("ko-KR")} P
          </strong>
        </div>
      )}

      {/* 후기 본문 */}
      <div className="space-y-1.5">
        <AppTextarea
          id="product-review-content"
          label={`후기 내용 (${policy.minLength}~${policy.maxLength}자) *`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          maxLength={policy.maxLength}
          placeholder="반려견의 기호성, 크기, 사용감 등 솔직한 경험을 남겨주세요."
        />
        <div className="flex items-center justify-between text-xs tabular-nums text-ink-muted">
          <span>
            {trimmedLength < policy.minLength
              ? `최소 ${policy.minLength - trimmedLength}자 더 작성해 주세요`
              : "작성 조건을 충족했어요"}
          </span>
          <span>
            {trimmedLength} / {policy.maxLength}
          </span>
        </div>
      </div>

      {/* 사진 첨부 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-ink">
            사진 첨부 ({imageUrls.length}/5){" "}
            <span className="font-normal text-xs text-ink-muted">· 장당 최대 15MB</span>
          </p>
          {mode === "create" &&
            policy.photoRewardPoint > policy.textRewardPoint &&
            imageUrls.length === 0 && (
              <span className="text-xs font-semibold text-brand-strong">
                사진 1장 이상 첨부 시 +{policy.photoRewardPoint.toLocaleString("ko-KR")}P
              </span>
            )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void handleUploadPhotos(e.target.files)}
        />

        <div className="flex flex-wrap gap-2">
          {imageUrls.length < 5 && (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex size-16 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border-subtle bg-surface-subtle text-ink-muted transition-colors hover:border-ink/30 hover:text-ink disabled:opacity-50"
            >
              <Camera className="size-4" strokeWidth={1.8} />
              <span className="text-xs font-semibold">
                {uploading ? "업로드" : "사진 추가"}
              </span>
            </button>
          )}
          {imageUrls.map((url, idx) => (
            <div
              key={url}
              className="relative size-16 overflow-hidden rounded-xl bg-surface-subtle"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`첨부 사진 ${idx + 1}`} className="size-full object-cover" />
              <button
                type="button"
                aria-label="사진 삭제"
                onClick={() => setImageUrls((prev) => prev.filter((_, i) => i !== idx))}
                className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/75 text-white"
              >
                <X className="size-3" strokeWidth={2.2} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <p className="rounded-xl bg-surface-subtle px-3.5 py-2.5 text-xs leading-relaxed text-ink-muted">
        • 구매 확정 상품의 후기는 포인트 지급 특성상 작성 후 삭제할 수 없으며, 내용 수정만 가능합니다.
        {mode === "edit" && (
          <>
            <br />• 후기 수정 시에는 포인트가 추가로 적립되거나 차감되지 않습니다.
          </>
        )}
      </p>

      <AppButton
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        loading={pending || uploading}
      >
        {pending
          ? mode === "edit"
            ? "수정 중..."
            : "등록 중..."
          : mode === "edit"
            ? "후기 수정 저장"
            : "후기 등록하기"}
      </AppButton>
    </form>
  );
}
