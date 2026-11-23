"use client";

import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { PointIcon, WaggleWordmark } from "@repo/ui";
import { getMobileRoutePresentation } from "@/00_lib/mobileRoutePresentation";
import { AppLink, AppLinkButton } from "@/components/web/ui";

interface MobileTopHeaderProps {
  isAuthenticated: boolean;
  pointBalance: number;
  unreadCount: number;
}

/**
 * (mobile) 상단 헤더 — Editorial Flat (아이콘 박스 제거 · 단색 그린 악센트)
 * - 5대 대표 탭(ROOT_TAB)에서만 포인트/알림 포함 풀 헤더 노출
 * - 온보딩 인트로/로그인/설문/결과(BRAND_FLOW)에서는 심플 로고만 표시
 * - 서브 페이지(SUB_PUSH) · 레슨 몰입(FULL_IMMERSION)에서는 숨겨 SubPageHeader 단독 최상단 고정 보장
 */
export function MobileTopHeader({
  isAuthenticated,
  pointBalance,
  unreadCount,
}: MobileTopHeaderProps) {
  const pathname = usePathname();
  const { showTopHeader, simpleTopHeader } = getMobileRoutePresentation(pathname);

  if (!showTopHeader) return null;

  const isOnboardingRoute = simpleTopHeader || pathname.startsWith("/app/onboarding");

  return (
    <header className="sticky top-0 z-20 shrink-0 bg-surface/92 px-4 backdrop-blur-md pt-safe-top">
      <div className="flex h-14 items-center justify-between">
        {isOnboardingRoute ? (
          <span aria-label="와글" className="flex items-center select-none">
            <WaggleWordmark className="h-7 w-auto text-brand" />
          </span>
        ) : (
          <AppLink
            href={isAuthenticated ? "/app" : "/app/onboarding/login"}
            aria-label="와글 홈"
            className="flex items-center"
          >
            <WaggleWordmark className="h-7 w-auto text-brand" />
          </AppLink>
        )}

        {!simpleTopHeader && (
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <AppLink
                  href="/app/wallet"
                  className="inline-flex h-8 items-center gap-1 whitespace-nowrap px-1.5 text-sm font-bold tabular-nums text-ink transition-opacity active:opacity-60"
                >
                  <PointIcon className="size-4 shrink-0 text-brand" />
                  {pointBalance.toLocaleString("ko-KR")}P
                </AppLink>
                <AppLink
                  href="/app/my/notifications"
                  aria-label="알림함"
                  className="relative flex size-9 shrink-0 items-center justify-center text-ink transition-opacity active:opacity-60"
                >
                  <Bell className="size-5" strokeWidth={1.9} />
                  {unreadCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand ring-2 ring-surface" />
                  )}
                </AppLink>
              </>
            ) : (
              <AppLinkButton href="/app/onboarding/login" variant="primary" size="xs" className="px-3">
                로그인
              </AppLinkButton>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
