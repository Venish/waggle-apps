"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useHorizontalDragScroll } from "@/02_hooks/useHorizontalDragScroll";

interface DailyPhotoCarouselProps {
  photos: string[];
  altPrefix: string;
}

/**
 * 일상 기록 본문 사진 캐로셀 (클릭 확대 없음 · 갤러리 탭에서만 확대)
 * - 1장: 본문 폭 100% 중앙 rounded-2xl (4:3)
 * - 2장+: 좌측 본문 정렬 + 우측 화면 끝까지 다음 사진 Peek(86% 폭) 풀블리드 스와이퍼 + 1/N 배지
 */
export function DailyPhotoCarousel({ photos, altPrefix }: DailyPhotoCarouselProps) {
  const { ref: scrollerRef, dragProps } = useHorizontalDragScroll<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState(0);

  if (photos.length === 0) return null;

  if (photos.length === 1) {
    return (
      <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-subtle">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[0]!}
          alt={`${altPrefix} 일상 사진 1`}
          draggable={false}
          className="size-full select-none object-cover"
        />
      </div>
    );
  }

  const getStepWidth = (el: HTMLDivElement) => {
    const firstSlide = el.firstElementChild as HTMLElement | null;
    return firstSlide ? firstSlide.offsetWidth + 10 : el.clientWidth; // gap-2.5 (10px)
  };

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll > 0 && el.scrollLeft >= maxScroll - 8) {
      setActiveIndex(photos.length - 1);
      return;
    }
    const stepWidth = getStepWidth(el);
    const idx = Math.round(el.scrollLeft / stepWidth);
    setActiveIndex(Math.max(0, Math.min(photos.length - 1, idx)));
  };

  const scrollToSlide = (targetIdx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(photos.length - 1, targetIdx));
    const maxScroll = el.scrollWidth - el.clientWidth;
    const left = clamped === photos.length - 1 ? maxScroll : clamped * getStepWidth(el);
    el.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    setActiveIndex(clamped);
  };

  return (
    <div className="group relative -mx-4">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        {...dragProps}
        className="no-scrollbar swipe-x flex snap-x snap-mandatory select-none gap-2.5 overflow-x-auto px-4 scroll-px-4 scroll-smooth cursor-grab active:cursor-grabbing"
      >
        {photos.map((url, idx) => (
          <div
            key={`${url}-${idx}`}
            className={`relative aspect-[4/3] w-[86%] shrink-0 overflow-hidden rounded-2xl bg-surface-subtle ${
              idx === photos.length - 1 ? "snap-end" : "snap-start"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${altPrefix} 일상 사진 ${idx + 1}`}
              draggable={false}
              className="pointer-events-none size-full select-none object-cover"
            />
          </div>
        ))}
      </div>

      {/* 데스크톱/마우스 보조 좌우 버튼 */}
      {activeIndex > 0 && (
        <button
          type="button"
          aria-label="이전 사진"
          onClick={() => scrollToSlide(activeIndex - 1)}
          className="absolute left-6 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/55 p-1.5 text-white backdrop-blur-xs transition-opacity sm:flex sm:opacity-0 sm:group-hover:opacity-100"
        >
          <ChevronLeft className="size-4" strokeWidth={2.2} />
        </button>
      )}
      {activeIndex < photos.length - 1 && (
        <button
          type="button"
          aria-label="다음 사진"
          onClick={() => scrollToSlide(activeIndex + 1)}
          className="absolute right-6 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/55 p-1.5 text-white backdrop-blur-xs transition-opacity sm:flex sm:opacity-0 sm:group-hover:opacity-100"
        >
          <ChevronRight className="size-4" strokeWidth={2.2} />
        </button>
      )}

      {/* 우측 하단 1 / N 카운터 배지 */}
      <div className="pointer-events-none absolute bottom-2.5 right-6 rounded-full bg-black/65 px-2.5 py-0.5 text-2xs font-semibold tabular-nums text-white backdrop-blur-xs">
        {activeIndex + 1} / {photos.length}
      </div>
    </div>
  );
}
