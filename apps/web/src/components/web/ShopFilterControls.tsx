"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHorizontalDragScroll } from "@/02_hooks/useHorizontalDragScroll";
import { AppSelect, type AppSelectOption } from "@/components/web/ui";

export type ShopSortKey = "default" | "price_asc" | "price_desc" | "reviews";

const SHOP_SORT_OPTIONS: readonly AppSelectOption<ShopSortKey>[] = [
  { value: "default", label: "추천순" },
  { value: "price_asc", label: "낮은 포인트순" },
  { value: "price_desc", label: "높은 포인트순" },
  { value: "reviews", label: "후기 많은순" },
];

export interface ShopCategoryItem {
  id: string;
  name: string;
}

function buildShopHref(cat: string, sort: ShopSortKey): string {
  const params = new URLSearchParams();
  if (cat !== "all") params.set("cat", cat);
  if (sort !== "default") params.set("sort", sort);
  const qs = params.toString();
  return qs ? `/app/shop?${qs}` : "/app/shop";
}

/**
 * 포인트샵 카테고리 가로 100% 풀블리드 스와이퍼 + 커스텀 정렬 Select
 * - 기본 상태: 좌측 본문 여백(px-4)만큼 떨어져 시작하고, 좌우 100% 끝까지 자유롭게 스와이핑
 * - 모바일 터치(.swipe-x: 가로 스와이프 + 세로 페이지 스크롤 공존) 및 데스크톱 마우스 드래그 지원
 */
export function ShopFilterControls({
  categories,
  activeCat,
  activeSort,
  totalCount,
}: {
  categories: ShopCategoryItem[];
  activeCat: string;
  activeSort: ShopSortKey;
  totalCount: number;
}) {
  const router = useRouter();
  const { ref: trackRef, dragProps } = useHorizontalDragScroll<HTMLDivElement>();

  // 우측 카테고리 선택 시 활성 칩을 뷰포트 안으로 자연스럽게 정렬
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const activeEl = track.querySelector<HTMLElement>('[data-active="true"]');
    if (!activeEl) return;
    if (activeCat === "all") {
      track.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCat, trackRef]);

  const handleSelectCat = (nextCat: string) => {
    if (nextCat === activeCat) return;
    router.replace(buildShopHref(nextCat, activeSort), { scroll: false });
  };

  const handleSelectSort = (nextSort: ShopSortKey) => {
    if (nextSort === activeSort) return;
    router.replace(buildShopHref(activeCat, nextSort), { scroll: false });
  };

  const allChips: ShopCategoryItem[] = [{ id: "all", name: "전체" }, ...categories];

  return (
    <div className="relative z-20 space-y-3">
      {/* 가로 100% 풀블리드 카테고리 스와이퍼 (초기 좌측 px-4 정렬) */}
      <div
        ref={trackRef}
        {...dragProps}
        role="tablist"
        aria-label="포인트샵 카테고리"
        className="no-scrollbar swipe-x -mx-4 flex select-none gap-1.5 overflow-x-auto px-4 pb-0.5 scroll-px-4 cursor-grab active:cursor-grabbing"
      >
        {allChips.map((chip) => {
          const isActive = activeCat === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-active={isActive ? "true" : "false"}
              onClick={() => handleSelectCat(chip.id)}
              className={`shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors active:scale-[0.97] ${
                isActive
                  ? "bg-ink text-surface"
                  : "bg-surface-subtle text-ink-muted hover:text-ink"
              }`}
            >
              {chip.name}
            </button>
          );
        })}
      </div>

      {/* 상품 수 + 공용 커스텀 Select 정렬 */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium tabular-nums text-ink-muted">
          총 <strong className="font-bold text-ink">{totalCount}</strong>개 상품
        </span>
        <AppSelect
          value={activeSort}
          onChange={handleSelectSort}
          options={SHOP_SORT_OPTIONS}
          align="right"
          size="sm"
          ariaLabel="상품 정렬 기준"
        />
      </div>
    </div>
  );
}
