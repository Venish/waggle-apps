"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, MessageSquareText, Pencil, Star } from "lucide-react";
import { useHorizontalDragScroll } from "@/02_hooks/useHorizontalDragScroll";
import type { ShopReviewPolicy } from "@/04_services/shared/policyService";
import type { ProductReviewStats } from "@/04_services/shared/shopReviewService";
import { useModalStore } from "@/01_store/web/useModalStore";
import { LightboxOverlay } from "@/components/web/ProductImageSwiper";
import {
  ProductReviewSheetForm,
  type EligibleOrderItemChoice,
} from "@/components/web/ProductReviewSheetForm";
import { EmptyStateCard } from "@/components/web/WebUiKit";
import { AppBadge, AppButton, AppChip, AppLinkButton, AppSegmented, AppSelect } from "@/components/web/ui";

export interface PublicProductReviewView {
  id: number;
  authorLabel: string;
  isMine: boolean;
  optionName: string;
  rating: number;
  content: string;
  imageUrls: string[];
  adminReply: string | null;
  adminRepliedAtText: string | null;
  createdAtText: string;
}

/** 상단 상품 정보에서 평점 클릭 시 하단 후기 탭으로 즉시 전환·스크롤하는 경량 트리거 */
export function ProductRatingJumpButton({
  avgRating,
  reviewCount,
}: {
  avgRating: number;
  reviewCount: number;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("waggle:open-product-reviews"))}
      className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-ink transition-opacity hover:opacity-75"
    >
      <Star className="size-3.5 fill-star text-star" strokeWidth={1.8} />
      <span className="tabular-nums font-bold">{reviewCount > 0 ? avgRating.toFixed(1) : "0.0"}</span>
      <span className="tabular-nums text-ink-muted">({reviewCount}개 후기)</span>
      <ChevronRight className="size-3.5 text-ink-muted" strokeWidth={2} />
    </button>
  );
}

/**
 * 개별 후기 카드 — 기본 3줄 요약 + 실제 overflow 시 클릭/버튼으로 인라인 더보기·접기
 */
function ReviewCardItem({
  review,
  onOpenPhotos,
  onEdit,
}: {
  review: PublicProductReviewView;
  onOpenPhotos: (urls: string[], startIndex: number) => void;
  onEdit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const { ref: reviewPhotoStripRef, dragProps: reviewPhotoDragProps } =
    useHorizontalDragScroll<HTMLDivElement>();

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;
    setHasOverflow(el.scrollHeight > el.clientHeight + 1);
  }, [review.content, expanded]);

  const handleToggleExpand = () => {
    if (!hasOverflow && !expanded) return;
    setExpanded((prev) => !prev);
  };

  return (
    <article className="space-y-3 py-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 text-star" aria-label={`별점 ${review.rating}점`}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`size-3.5 ${s <= review.rating ? "fill-current" : "text-border-subtle"}`}
                  strokeWidth={1.8}
                />
              ))}
            </div>
            <span className="text-xs font-bold text-ink">{review.authorLabel}</span>
            {review.isMine && <AppBadge tone="brand">내 후기</AppBadge>}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {review.optionName} · <span className="tabular-nums">{review.createdAtText}</span>
          </p>
        </div>

        {review.isMine && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-lg bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-ink-muted hover:text-ink"
          >
            <Pencil className="size-3" strokeWidth={2} />
            수정
          </button>
        )}
      </div>

      {/* 본문 요약(3줄) -> 클릭 시 전체 펼침 */}
      <div>
        <p
          ref={textRef}
          onClick={handleToggleExpand}
          className={`whitespace-pre-line text-sm leading-relaxed text-ink ${
            expanded ? "" : "line-clamp-3"
          } ${hasOverflow || expanded ? "cursor-pointer" : ""}`}
        >
          {review.content}
        </p>
        {(hasOverflow || expanded) && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-ink-muted hover:text-ink"
          >
            {expanded ? (
              <>
                접기
                <ChevronUp className="size-3.5" strokeWidth={2} />
              </>
            ) : (
              <>
                더보기
                <ChevronDown className="size-3.5" strokeWidth={2} />
              </>
            )}
          </button>
        )}
      </div>

      {/* 후기 포토 썸네일 */}
      {review.imageUrls.length > 0 && (
        <div
          ref={reviewPhotoStripRef}
          {...reviewPhotoDragProps}
          className="no-scrollbar swipe-x flex select-none gap-2 overflow-x-auto cursor-grab active:cursor-grabbing"
        >
          {review.imageUrls.map((url, idx) => (
            <button
              key={`${url}-${idx}`}
              type="button"
              onClick={() => onOpenPhotos(review.imageUrls, idx)}
              className="size-18 shrink-0 overflow-hidden rounded-xl bg-surface-subtle"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`후기 사진 ${idx + 1}`}
                draggable={false}
                className="pointer-events-none size-full select-none object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* 관리자 공식 답글 */}
      {review.adminReply && (
        <div className="rounded-2xl bg-surface-subtle px-3.5 py-3 text-xs leading-relaxed">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-ink">와글 운영팀 답변</span>
            {review.adminRepliedAtText && (
              <span className="text-xs tabular-nums text-ink-muted">
                {review.adminRepliedAtText}
              </span>
            )}
          </div>
          <p className="mt-1.5 whitespace-pre-line text-ink-muted">{review.adminReply}</p>
        </div>
      )}
    </article>
  );
}

interface ProductDetailTabsClientProps {
  productName: string;
  isPhysical: boolean;
  detailHtml: string | null;
  fallbackDescription: string | null;
  reviews: PublicProductReviewView[];
  stats: ProductReviewStats;
  eligibleOrderItems: EligibleOrderItemChoice[];
  hasDeliveredUnconfirmed: boolean;
  reviewPolicy: ShopReviewPolicy;
}

export function ProductDetailTabsClient({
  productName,
  isPhysical,
  detailHtml,
  fallbackDescription,
  reviews,
  stats,
  eligibleOrderItems,
  hasDeliveredUnconfirmed,
  reviewPolicy,
}: ProductDetailTabsClientProps) {
  const [activeTab, setActiveTab] = useState<"detail" | "reviews">("detail");
  const [photoOnly, setPhotoOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"latest" | "rating">("latest");
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  const anchorRef = useRef<HTMLDivElement | null>(null);
  const { ref: summaryPhotoStripRef, dragProps: summaryPhotoDragProps } =
    useHorizontalDragScroll<HTMLDivElement>();
  const openModal = useModalStore((s) => s.openModal);
  const closeTopModal = useModalStore((s) => s.closeTopModal);

  const scrollToTabsTop = () => {
    const el = anchorRef.current;
    if (!el) return;
    const headerOffset = 60; // SubPageHeader h-14 (56px) + subtle breathing room
    const appShell = document.querySelector<HTMLElement>("[data-waggle-app]");
    const shellOverflowY = appShell ? getComputedStyle(appShell).overflowY : "";
    if (appShell && (shellOverflowY === "auto" || shellOverflowY === "scroll")) {
      const top =
        el.getBoundingClientRect().top -
        appShell.getBoundingClientRect().top +
        appShell.scrollTop -
        headerOffset;
      appShell.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      return;
    }
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  useEffect(() => {
    if (!isPhysical) return;
    const onOpenReviews = () => {
      setActiveTab("reviews");
      requestAnimationFrame(() => scrollToTabsTop());
    };
    window.addEventListener("waggle:open-product-reviews", onOpenReviews);
    return () => window.removeEventListener("waggle:open-product-reviews", onOpenReviews);
  }, [isPhysical]);

  const handleTabChange = (next: "detail" | "reviews") => {
    setActiveTab(next);
    const el = anchorRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      // 탭 바가 이미 상단에 붙어 있거나 위쪽으로 지나갔을 때만 탭 시작점으로 스크롤 보정
      if (rect.top < 64) {
        scrollToTabsTop();
      }
    }
  };

  const allPhotoEntries = useMemo(
    () =>
      reviews.flatMap((r) =>
        r.imageUrls.map((url) => ({
          url,
          reviewId: r.id,
        })),
      ),
    [reviews],
  );

  const filteredReviews = useMemo(() => {
    let list = reviews;
    if (photoOnly) list = list.filter((r) => r.imageUrls.length > 0);
    if (starFilter !== null) list = list.filter((r) => r.rating === starFilter);
    if (sortBy === "rating") {
      return [...list].sort((a, b) => b.rating - a.rating || b.id - a.id);
    }
    return list;
  }, [reviews, photoOnly, starFilter, sortBy]);

  const openWriteReviewModal = () => {
    openModal({
      id: `write-review-${eligibleOrderItems[0]?.orderItemId ?? "new"}`,
      title: "상품 후기 작성",
      subtitle: "구매 확정해 주셔서 감사해요",
      direction: "slide-up",
      content: (
        <ProductReviewSheetForm
          mode="create"
          productName={productName}
          policy={reviewPolicy}
          eligibleOrderItems={eligibleOrderItems}
          onDone={closeTopModal}
        />
      ),
    });
  };

  const openEditReviewModal = (rev: PublicProductReviewView) => {
    openModal({
      id: `edit-review-${rev.id}`,
      title: "상품 후기 수정",
      subtitle: productName,
      direction: "slide-up",
      content: (
        <ProductReviewSheetForm
          mode="edit"
          productName={productName}
          policy={reviewPolicy}
          existingReview={{
            id: rev.id,
            rating: rev.rating,
            content: rev.content,
            imageUrls: rev.imageUrls,
          }}
          onDone={closeTopModal}
        />
      ),
    });
  };

  const maxRewardPoint = Math.max(reviewPolicy.textRewardPoint, reviewPolicy.photoRewardPoint);

  const renderDetailSection = () => (
    <section className="pt-5">
      {detailHtml ? (
        <div
          className="waggle-prose"
          dangerouslySetInnerHTML={{ __html: detailHtml }}
        />
      ) : fallbackDescription ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">
          {fallbackDescription}
        </p>
      ) : (
        <p className="py-6 text-center text-sm text-ink-muted">
          등록된 상세 설명이 없습니다.
        </p>
      )}
    </section>
  );

  // 디지털 상품(코스 해제 / 문의권): 후기 탭 없이 상세 섹션만 깔끔히 노출
  if (!isPhysical) {
    return (
      <div className="border-t border-border-subtle pt-2">
        <h3 className="pt-3 text-sm font-bold text-ink">상품 상세 정보</h3>
        {renderDetailSection()}
      </div>
    );
  }

  return (
    <div ref={anchorRef} className="pt-1">
      {/* Sticky Tab Bar — 공용 AppSegmented(underline) */}
      <AppSegmented
        variant="underline"
        asTabs
        ariaLabel="상품 상세 및 후기 탭"
        value={activeTab}
        onChange={handleTabChange}
        options={[
          { value: "detail", label: "상품 상세" },
          { value: "reviews", label: "후기", count: stats.reviewCount },
        ]}
        className="sticky-below-header sticky z-10 -mx-4 px-4"
      />

      {activeTab === "detail" ? (
        renderDetailSection()
      ) : (
        <section className="space-y-5 pt-5">
          {/* 1. 평점 요약 카드 (평균 별점 + 5~1점 가로 분포 막대) */}
          <div className="grid grid-cols-[auto_1fr] items-center gap-5 rounded-2xl bg-surface-subtle p-4">
            <div className="flex flex-col items-center justify-center px-2 text-center">
              <p className="text-3xl font-extrabold tracking-tight tabular-nums text-ink">
                {stats.reviewCount > 0 ? stats.avgRating.toFixed(1) : "0.0"}
              </p>
              <div className="mt-1 flex items-center gap-0.5 text-star">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`size-3.5 ${
                      s <= Math.round(stats.avgRating) ? "fill-current" : "text-border-subtle"
                    }`}
                    strokeWidth={1.8}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs font-medium tabular-nums text-ink-muted">
                {stats.reviewCount}개 후기
              </p>
            </div>

            <div className="space-y-1.5">
              {([5, 4, 3, 2, 1] as const).map((score) => {
                const count = stats.distribution[score];
                const pct = stats.reviewCount > 0 ? Math.round((count / stats.reviewCount) * 100) : 0;
                const selected = starFilter === score;
                return (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setStarFilter((prev) => (prev === score ? null : score))}
                    className={`flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-xs transition-colors ${
                      selected ? "bg-surface font-bold text-ink" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    <span className="w-6 shrink-0 text-left tabular-nums">{score}점</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border-subtle">
                      <div
                        className="h-full rounded-full bg-warning transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 포토 후기 모아보기 스트립 */}
          {allPhotoEntries.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-ink">
                포토 후기 모아보기{" "}
                <span className="tabular-nums text-ink-muted">({allPhotoEntries.length})</span>
              </p>
              <div
                ref={summaryPhotoStripRef}
                {...summaryPhotoDragProps}
                className="no-scrollbar swipe-x flex select-none gap-2 overflow-x-auto cursor-grab active:cursor-grabbing"
              >
                {allPhotoEntries.slice(0, 12).map((entry, idx) => (
                  <button
                    key={`${entry.url}-${idx}`}
                    type="button"
                    onClick={() =>
                      setLightbox({
                        images: allPhotoEntries.map((e) => e.url),
                        index: idx,
                      })
                    }
                    className="size-18 shrink-0 overflow-hidden rounded-xl bg-surface-subtle"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.url}
                      alt={`포토 후기 ${idx + 1}`}
                      draggable={false}
                      className="pointer-events-none size-full select-none object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. 구매 확정자 전용 후기 작성 CTA */}
          {eligibleOrderItems.length > 0 ? (
            <AppButton
              variant="primary"
              size="md"
              fullWidth
              onClick={openWriteReviewModal}
            >
              <Pencil className="size-4" strokeWidth={2} />
              후기 작성하기
              {maxRewardPoint > 0 && (
                <span className="rounded-full bg-surface/20 px-2 py-0.5 text-xs font-bold tabular-nums">
                  최대 +{maxRewardPoint.toLocaleString("ko-KR")}P
                </span>
              )}
            </AppButton>
          ) : hasDeliveredUnconfirmed ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-subtle px-4 py-3 text-xs">
              <p className="leading-relaxed text-ink-muted">
                배송 완료된 주문이 있어요. <strong className="font-semibold text-ink">구매 확정</strong> 후
                후기를 작성할 수 있어요.
              </p>
              <AppLinkButton href="/app/shop/orders" variant="secondary" size="xs" className="shrink-0">
                주문내역
              </AppLinkButton>
            </div>
          ) : null}

          {/* 4. 필터 · 정렬 바 */}
          {reviews.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <AppChip selected={photoOnly} onClick={() => setPhotoOnly((p) => !p)}>
                  포토 후기만
                </AppChip>
                {starFilter !== null && (
                  <AppChip selected onClick={() => setStarFilter(null)}>
                    {starFilter}점 ×
                  </AppChip>
                )}
              </div>

              <AppSelect
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: "latest", label: "최신순" },
                  { value: "rating", label: "평점 높은순" },
                ]}
                align="right"
                size="sm"
                ariaLabel="후기 정렬 기준"
              />
            </div>
          )}

          {/* 5. 후기 리스트 */}
          {filteredReviews.length === 0 ? (
            <EmptyStateCard
              mode="section"
              icon={<MessageSquareText className="size-5.5" strokeWidth={1.7} />}
              title={
                reviews.length === 0
                  ? "아직 등록된 후기가 없습니다"
                  : "조건에 맞는 후기가 없습니다"
              }
              description={
                reviews.length === 0
                  ? "상품을 구매 확정한 뒤 첫 번째 솔직한 후기를 남겨보세요."
                  : "필터를 해제하고 다른 후기를 확인해 보세요."
              }
            />
          ) : (
            <div className="divide-y divide-border-subtle border-t border-border-subtle">
              {filteredReviews.map((rev) => (
                <ReviewCardItem
                  key={rev.id}
                  review={rev}
                  onOpenPhotos={(imgs, idx) => setLightbox({ images: imgs, index: idx })}
                  onEdit={() => openEditReviewModal(rev)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {lightbox && (
        <LightboxOverlay
          images={lightbox.images}
          index={lightbox.index}
          altPrefix={`${productName} 후기`}
          onChangeIndex={(next) => setLightbox((prev) => (prev ? { ...prev, index: next } : null))}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
