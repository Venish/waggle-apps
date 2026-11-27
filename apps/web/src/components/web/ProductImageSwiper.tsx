"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { WaggleMark } from "@repo/ui";
import { useHorizontalDragScroll } from "@/02_hooks/useHorizontalDragScroll";

interface ProductImageSwiperProps {
  images: string[];
  productName: string;
}

/**
 * 상품 상세 상단 풀블리드 이미지 스와이퍼
 * - 0장: Primary 컬러(bg-brand) + 중앙 WaggleMark(logo_mark) 테마 연동 폴백
 * - 1장: 가로 100% 풀블리드 정사각 이미지
 * - 2장+: 가로 100% 꽉 찬 스와이퍼 + 우측 다음 이미지 Peek(86% 폭) 노출 + 모바일 터치·데스크톱 마우스 드래그 + 1/N 배지 + 탭 확대 라이트박스
 */
export function ProductImageSwiper({ images, productName }: ProductImageSwiperProps) {
  const { ref: scrollerRef, dragProps } = useHorizontalDragScroll<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev === null ? null : Math.min(images.length - 1, prev + 1)));
      }
      if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev === null ? null : Math.max(0, prev - 1)));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxIndex, images.length]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || images.length <= 1) return;
    const firstSlide = el.firstElementChild as HTMLElement | null;
    if (!firstSlide) return;
    const stepWidth = firstSlide.offsetWidth + 8; // gap-2 (0.5rem = 8px)
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll > 0 && el.scrollLeft >= maxScroll - 8) {
      setActiveIndex(images.length - 1);
      return;
    }
    const idx = Math.round(el.scrollLeft / stepWidth);
    setActiveIndex(Math.max(0, Math.min(images.length - 1, idx)));
  };

  const scrollToSlide = (targetIdx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(images.length - 1, targetIdx));
    const slide = el.children[clamped] as HTMLElement | undefined;
    if (!slide) return;
    el.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
    setActiveIndex(clamped);
  };

  // 0장: Primary 컬러 배경 + 중앙 logo_mark(WaggleMark)
  if (images.length === 0) {
    return (
      <div className="-mx-4">
        <div
          aria-label={`${productName} 기본 브랜드 이미지`}
          className="flex aspect-square w-full flex-col items-center justify-center bg-brand"
        >
          <WaggleMark className="w-[34%] max-w-36 text-on-brand/95" />
        </div>
      </div>
    );
  }

  // 1장: 가로 100% 풀블리드
  if (images.length === 1) {
    return (
      <>
        <div className="-mx-4">
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className="block aspect-square w-full overflow-hidden bg-surface-subtle focus:outline-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[0]!}
              alt={productName}
              draggable={false}
              className="size-full select-none object-cover"
            />
          </button>
        </div>

        {lightboxIndex !== null && (
          <LightboxOverlay
            images={images}
            index={lightboxIndex}
            altPrefix={productName}
            onChangeIndex={setLightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </>
    );
  }

  // 2장+: 가로 100% 풀블리드 + 우측 다음 이미지 일부 노출(Peek) 스와이퍼
  return (
    <>
      <div className="group relative -mx-4">
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          {...dragProps}
          className="no-scrollbar swipe-x flex snap-x snap-mandatory select-none gap-2 overflow-x-auto scroll-smooth cursor-grab active:cursor-grabbing"
        >
          {images.map((url, idx) => (
            <button
              key={`${url}-${idx}`}
              type="button"
              onClick={() => setLightboxIndex(idx)}
              className={`relative aspect-square w-[86%] shrink-0 overflow-hidden bg-surface-subtle focus:outline-none ${
                idx === images.length - 1 ? "snap-end" : "snap-start"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${productName} 이미지 ${idx + 1}`}
                draggable={false}
                className="pointer-events-none size-full select-none object-cover"
              />
            </button>
          ))}
        </div>

        {/* 데스크톱/마우스 보조 좌우 버튼 */}
        {activeIndex > 0 && (
          <button
            type="button"
            aria-label="이전 이미지"
            onClick={() => scrollToSlide(activeIndex - 1)}
            className="absolute left-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/55 p-1.5 text-white backdrop-blur-xs transition-opacity sm:flex sm:opacity-0 sm:group-hover:opacity-100"
          >
            <ChevronLeft className="size-4" strokeWidth={2.2} />
          </button>
        )}
        {activeIndex < images.length - 1 && (
          <button
            type="button"
            aria-label="다음 이미지"
            onClick={() => scrollToSlide(activeIndex + 1)}
            className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/55 p-1.5 text-white backdrop-blur-xs transition-opacity sm:flex sm:opacity-0 sm:group-hover:opacity-100"
          >
            <ChevronRight className="size-4" strokeWidth={2.2} />
          </button>
        )}

        {/* 우측 하단 1 / N 카운터 배지 */}
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-1 text-2xs font-semibold tabular-nums text-white backdrop-blur-xs">
          {activeIndex + 1} / {images.length}
        </div>
      </div>

      {lightboxIndex !== null && (
        <LightboxOverlay
          images={images}
          index={lightboxIndex}
          altPrefix={productName}
          onChangeIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}

export function LightboxOverlay({
  images,
  index,
  altPrefix,
  onChangeIndex,
  onClose,
}: {
  images: string[];
  index: number;
  altPrefix: string;
  onChangeIndex: (next: number) => void;
  onClose: () => void;
}) {
  const touchStartXRef = useRef<number | null>(null);
  const currentUrl = images[index];
  if (!currentUrl) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || images.length <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const dx = endX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (dx <= -40 && index < images.length - 1) {
      onChangeIndex(index + 1);
    } else if (dx >= 40 && index > 0) {
      onChangeIndex(index - 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/92 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="이미지 확대 보기"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3 pt-safe-top text-white">
        <span className="text-xs font-semibold tabular-nums">
          {index + 1} / {images.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
        >
          <X className="size-5" strokeWidth={2} />
        </button>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currentUrl}
        alt={`${altPrefix} 확대 이미지 ${index + 1}`}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[78dvh] max-w-full select-none rounded-2xl object-contain"
      />

      {images.length > 1 && (
        <div
          className="mt-4 flex items-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onChangeIndex(Math.max(0, index - 1))}
            className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-30"
            aria-label="이전 사진"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            disabled={index === images.length - 1}
            onClick={() => onChangeIndex(Math.min(images.length - 1, index + 1))}
            className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-30"
            aria-label="다음 사진"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}
