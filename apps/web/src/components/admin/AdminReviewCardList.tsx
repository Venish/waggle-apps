"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, MessageSquareReply, Star, X } from "lucide-react";
import { toAdminUploadUrl } from "@/00_lib/mediaUrl";
import { useSubmitLock } from "@/02_hooks/useSubmitLock";
import {
  adminReplyProductReviewAction,
  adminToggleReviewHiddenAction,
} from "@/03_actions/admin/adminCommerceActions";
import { useAdminAlertStore } from "@/01_store/admin/useAdminAlertStore";
import { AdminStatusBadge } from "@/components/admin/AdminUiKit";

export interface AdminReviewItemView {
  id: number;
  productId: number;
  productName: string;
  userId: number;
  userNickname: string;
  orderNo: string;
  orderItemName: string;
  rating: number;
  content: string;
  imageUrls: string[];
  rewardPoint: number;
  isHidden: boolean;
  adminReply: string | null;
  adminRepliedAtText: string | null;
  createdAtText: string;
}

export function AdminReviewCardList({
  reviews,
  showProductLink = true,
}: {
  reviews: AdminReviewItemView[];
  showProductLink?: boolean;
}) {
  const router = useRouter();
  const openAlert = useAdminAlertStore((s) => s.openAlert);
  const { pending, run } = useSubmitLock();
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>(() =>
    Object.fromEntries(reviews.map((r) => [r.id, r.adminReply ?? ""])),
  );
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  const handleToggleHidden = (review: AdminReviewItemView) => {
    void run(async () => {
      const res = await adminToggleReviewHiddenAction({
        reviewId: review.id,
        isHidden: !review.isHidden,
      });
      if (!res.ok) {
        openAlert({ title: "상태 변경 실패", description: res.error.message, tone: "negative" });
        return;
      }
      router.refresh();
      openAlert({
        title: review.isHidden ? "후기가 공개 복구되었습니다" : "후기가 숨김(블라인드) 처리되었습니다",
        description: "사용자 포인트샵 화면에 즉시 반영됩니다.",
      });
    });
  };

  const handleSaveReply = (reviewId: number) => {
    void run(async () => {
      const text = replyDrafts[reviewId] ?? "";
      const res = await adminReplyProductReviewAction({
        reviewId,
        adminReply: text,
      });
      if (!res.ok) {
        openAlert({ title: "답글 저장 실패", description: res.error.message, tone: "negative" });
        return;
      }
      router.refresh();
      openAlert({
        title: text.trim() ? "공식 답글이 저장되었습니다" : "공식 답글이 삭제되었습니다",
        description: text.trim()
          ? "상품 상세 후기 영역에 공식 답글이 노출됩니다."
          : "후기의 공식 답글이 제거되었습니다.",
      });
    });
  };

  if (reviews.length === 0) {
    return (
      <div className="rounded-panel bg-base-2 p-8 text-center text-xs text-subdued atlas-border">
        등록된 상품 후기가 없습니다.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {reviews.map((rev) => (
          <article
            key={rev.id}
            className="space-y-3 rounded-panel bg-base-2 p-4 atlas-border"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-subdued">#{rev.id}</span>
                <span className="inline-flex items-center gap-0.5 text-star">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`size-3.5 ${i < rev.rating ? "fill-current" : "opacity-25"}`}
                    />
                  ))}
                </span>
                <span className="font-mono text-xs font-semibold tabular-nums text-neutral">
                  {rev.rating}.0
                </span>
                <AdminStatusBadge tone={rev.isHidden ? "negative" : "positive"}>
                  {rev.isHidden ? "숨김(블라인드)" : "공개"}
                </AdminStatusBadge>
                {rev.rewardPoint > 0 && (
                  <AdminStatusBadge tone="info">
                    적립 +{rev.rewardPoint.toLocaleString("ko-KR")} P
                  </AdminStatusBadge>
                )}
                {rev.imageUrls.length > 0 && (
                  <AdminStatusBadge tone="neutral">사진 {rev.imageUrls.length}장</AdminStatusBadge>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-subdued">
                <Link
                  href={`/admin/users/${rev.userId}`}
                  className="font-medium text-neutral hover:underline"
                >
                  {rev.userNickname} (#{rev.userId})
                </Link>
                <span className="font-mono">{rev.orderNo}</span>
                <span className="font-mono tabular-nums">{rev.createdAtText}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleToggleHidden(rev)}
                  className={`inline-flex h-6 items-center gap-1 rounded-btn-sm px-2 text-xs font-medium atlas-border ${
                    rev.isHidden ? "text-positive" : "text-negative"
                  }`}
                >
                  {rev.isHidden ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                  {rev.isHidden ? "공개 복구" : "숨김 처리"}
                </button>
              </div>
            </div>

            {showProductLink && (
              <div className="text-xs text-secondary">
                상품:{" "}
                <Link
                  href={`/admin/products/${rev.productId}`}
                  className="font-medium text-info hover:underline"
                >
                  {rev.productName}
                </Link>
                <span className="ml-2 text-subdued">({rev.orderItemName})</span>
              </div>
            )}

            <p className="whitespace-pre-line rounded-control bg-base-1 px-3 py-2.5 text-sm leading-relaxed text-neutral atlas-border">
              {rev.content}
            </p>

            {rev.imageUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {rev.imageUrls.map((url, idx) => {
                  const adminUrl = toAdminUploadUrl(url);
                  return (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setZoomImageUrl(adminUrl)}
                      className="size-16 overflow-hidden rounded-control bg-base-1 atlas-border hover:opacity-90"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={adminUrl}
                        alt={`후기 첨부 이미지 ${idx + 1}`}
                        className="size-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {/* 관리자 공식 답글 */}
            <div className="space-y-1.5 pt-2 atlas-border-t">
              <div className="flex items-center justify-between text-xs text-secondary">
                <span className="inline-flex items-center gap-1 font-medium">
                  <MessageSquareReply className="size-3.5" />
                  관리자 공식 답글
                </span>
                {rev.adminRepliedAtText && (
                  <span className="font-mono text-subdued">최근 등록: {rev.adminRepliedAtText}</span>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <textarea
                  rows={2}
                  value={replyDrafts[rev.id] ?? ""}
                  onChange={(e) =>
                    setReplyDrafts((prev) => ({ ...prev, [rev.id]: e.target.value }))
                  }
                  placeholder="고객 후기에 노출될 공식 답글을 입력하세요. (비우고 저장하면 답글 삭제)"
                  className="min-w-0 flex-1 rounded-control bg-base-1 px-2.5 py-2 text-xs text-neutral atlas-border"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleSaveReply(rev.id)}
                  className="h-8 shrink-0 self-end rounded-control bg-inverse px-3 text-xs font-medium text-on-inverse disabled:opacity-50"
                >
                  답글 저장
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Photo Lightbox */}
      {zoomImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomImageUrl(null)}
        >
          <button
            type="button"
            onClick={() => setZoomImageUrl(null)}
            aria-label="닫기"
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomImageUrl}
            alt="후기 사진 원본"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] rounded-panel object-contain"
          />
        </div>
      )}
    </>
  );
}
