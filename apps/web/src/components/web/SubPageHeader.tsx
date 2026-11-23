"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { resolveAppBackTarget } from "@/00_lib/mobileNavHistory";
import { getMobileRoutePresentation } from "@/00_lib/mobileRoutePresentation";

export interface SubPageHeaderProps {
  title: string;
  backHref?: string;
  /** 미지정 시 mobileRoutePresentation.ts 분류(push: 좌측 ← / modal: 우상단 ×)를 자동 적용 */
  mode?: "push" | "modal";
  /** 완료 화면 등 뒤로가기 대신 고정 backHref 이동이 반드시 필요한 경우 true */
  forceBackHref?: boolean;
  right?: ReactNode;
}

/**
 * (mobile) 서브·독립 모달 페이지 Top 0 단독 Sticky 헤더 (전 화면 정중앙 타이틀 통일)
 * - push 모드: [ ← ] | 정중앙 타이틀 | [ 선택 우측 ]
 * - modal 모드: [ 빈칸 ] | 정중앙 타이틀 | [ × ]
 * - iOS 노치 대응: 외부 pt-safe-top + 내부 h-14 분리로 상단 안전영역 침범 차단
 * - 스마트 뒤로가기: 앱 내부 이동 스택의 직전 화면으로 ViewTransition 복귀,
 *   직접 URL 진입·외부 유입 시 backHref로 안전 폴백한다.
 */
export function SubPageHeader({
  title,
  backHref = "/app",
  mode,
  forceBackHref = false,
  right,
}: SubPageHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const resolvedMode = mode ?? getMobileRoutePresentation(pathname).headerMode;

  const handleBack = () => {
    const target = resolveAppBackTarget(pathname, backHref, forceBackHref);
    const backTransition = resolvedMode === "modal" ? "waggle-modal-down" : "waggle-push-back";
    router.replace(target, { scroll: false, transitionTypes: [backTransition] });
  };

  return (
    <header className="sticky top-0 z-20 -mx-4 bg-surface/92 px-4 backdrop-blur-md pt-safe-top">
      <div className="grid h-14 grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
        {/* 좌측 슬롯 */}
        <div className="flex items-center justify-start">
          {resolvedMode === "push" && (
            <button
              type="button"
              onClick={handleBack}
              aria-label="뒤로가기"
              className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition-[background-color,transform] duration-150 hover:bg-ink/[0.06] active:scale-[0.94]"
            >
              <ChevronLeft className="size-6" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* 정중앙 타이틀 */}
        <h1 className="min-w-0 truncate text-center text-base font-bold leading-snug tracking-tight text-ink">
          {title}
        </h1>

        {/* 우측 슬롯 */}
        <div className="flex items-center justify-end">
          {resolvedMode === "modal" ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label="닫기"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink/80 transition-[background-color,transform,color] duration-150 hover:bg-ink/[0.11] hover:text-ink active:scale-[0.94]"
            >
              <X className="size-5.5" strokeWidth={1.6} />
            </button>
          ) : (
            right
          )}
        </div>
      </div>
    </header>
  );
}
