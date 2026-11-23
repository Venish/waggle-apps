"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui";
import {
  clearPendingScrollRestore,
  getSavedAppScrollPosition,
  peekPendingScrollRestore,
  recordAppNav,
  saveAppScrollPosition,
} from "@/00_lib/mobileNavHistory";
import { getMobileRoutePresentation } from "@/00_lib/mobileRoutePresentation";

/**
 * (mobile) <main> 동적 여백 · 내부 네비게이션 스택 추적 · 데스크톱 프레임 스크롤 복원 래퍼
 * - ROOT_TAB (5): 하단 플로팅 바 여백(pb-28 pt-4), 내부 페이지는 .waggle-stagger 적용
 * - BRAND_FLOW: 심플 헤더 아래 pt-4 pb-10, 부드러운 페이드인
 * - SUB_PUSH / MODAL_PAGE: 상단 SubPageHeader가 Top 0에 밀착되도록 pt-0 pb-10
 *   (화면 전환 모션은 MobileViewTransitionShell의 네이티브 ViewTransition이 전담)
 */
export function MobileShellMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { mode } = getMobileRoutePresentation(pathname);
  const browserPopRef = useRef(false);
  const restoringRef = useRef(false);

  const isDesktopShellScroll = (appShell: HTMLElement | null): appShell is HTMLElement => {
    if (!appShell) return false;
    const ov = getComputedStyle(appShell).overflowY;
    return ov === "auto" || ov === "scroll";
  };

  // 브라우저 물리 뒤로가기/앞으로가기(popstate) 감지
  useEffect(() => {
    const onPopState = () => {
      browserPopRef.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // 현재 경로의 스크롤 위치 기록 (데스크톱 앱 프레임 / 모바일 window 자동 분기)
  useEffect(() => {
    const appShell = document.querySelector<HTMLElement>("[data-waggle-app]");
    const onScroll = () => {
      if (restoringRef.current || window.location.pathname !== pathname) return;
      const top = isDesktopShellScroll(appShell) ? appShell.scrollTop : window.scrollY;
      saveAppScrollPosition(pathname, top);
    };
    appShell?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      appShell?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  useEffect(() => {
    const fullHref =
      typeof window !== "undefined" && window.location.pathname === pathname
        ? `${pathname}${window.location.search}`
        : pathname;
    recordAppNav(pathname, mode, fullHref);

    const appShell = document.querySelector<HTMLElement>("[data-waggle-app]");
    const pendingRestore = peekPendingScrollRestore(pathname);
    const shouldRestore = pendingRestore !== null || browserPopRef.current;

    const applyScroll = (top: number) => {
      if (isDesktopShellScroll(appShell)) {
        appShell.scrollTop = top;
      } else {
        window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
      }
    };

    if (shouldRestore) {
      const targetTop = pendingRestore ?? getSavedAppScrollPosition(pathname);
      restoringRef.current = true;
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        applyScroll(targetTop);
        raf2 = requestAnimationFrame(() => {
          applyScroll(targetTop);
          clearPendingScrollRestore(pathname);
          browserPopRef.current = false;
          restoringRef.current = false;
        });
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
        restoringRef.current = false;
      };
    }

    browserPopRef.current = false;
    applyScroll(0);
  }, [pathname, mode]);

  const paddingClass =
    mode === "ROOT_TAB"
      ? "px-4 pb-28 pt-4"
      : mode === "BRAND_FLOW"
        ? "px-4 pb-14 pt-4"
        : "px-4 pb-10 pt-0";

  return (
    <main className={cn("z-10 flex flex-1 flex-col", paddingClass)}>
      {mode === "BRAND_FLOW" ? (
        <div key={pathname} className="animate-fade-in flex flex-1 flex-col">
          {children}
        </div>
      ) : (
        children
      )}
    </main>
  );
}
