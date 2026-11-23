"use client";

import type { MobileRouteMode } from "@/00_lib/mobileRoutePresentation";

const MAX_STACK_LENGTH = 30;

/** 완료 영수증 등 뒤로가기 대상이 되어서는 안 되는 일회성 경로 */
const TRANSIENT_ROUTES = new Set(["/app/wallet/recharge/result"]);

interface NavEntry {
  pathname: string;
  href: string;
}

/**
 * 현재 SPA 세션 전용 무순환(Cycle-Free) 메모리 네비게이션 스택
 * - sessionStorage 대신 메모리를 사용해 새 탭 · 푸시 딥링크 · 주소창 직접 입력 · 새로고침 시
 *   이전 세션 잔재로 인한 잘못된 뒤로가기 오염을 원천 차단한다.
 * - 동일 pathname 재방문 시 기존 위치 이후를 잘라내(indexOf slice) 순환 루프를 차단하면서,
 *   href(pathname + search)를 보존해 뒤로가기 시 탭·반려견 쿼리까지 정확히 복귀한다.
 */
let navStack: NavEntry[] = [];

function stripQuery(href: string): string {
  const idx = href.indexOf("?");
  return idx === -1 ? href : href.slice(0, idx);
}

/** 데스크톱 내부 앱 프레임(.waggle-app-shell) / 모바일 경로별 스크롤 위치 캐시 (뒤로가기 복원용) */
const scrollPositionMap = new Map<string, number>();
let pendingRestorePath: string | null = null;

export function saveAppScrollPosition(pathname: string, scrollTop: number) {
  if (scrollPositionMap.size >= MAX_STACK_LENGTH && !scrollPositionMap.has(pathname)) {
    const oldestKey = scrollPositionMap.keys().next().value;
    if (oldestKey !== undefined) scrollPositionMap.delete(oldestKey);
  }
  scrollPositionMap.set(pathname, scrollTop);
}

export function getSavedAppScrollPosition(pathname: string): number {
  return scrollPositionMap.get(pathname) ?? 0;
}

export function markPendingScrollRestore(pathname: string) {
  pendingRestorePath = pathname;
}

export function peekPendingScrollRestore(pathname: string): number | null {
  if (pendingRestorePath !== pathname) return null;
  return scrollPositionMap.get(pathname) ?? 0;
}

export function clearPendingScrollRestore(pathname: string) {
  if (pendingRestorePath === pathname) {
    pendingRestorePath = null;
  }
}

/**
 * (mobile) 앱 내부 라우트 이동 스택 기록
 * - ROOT_TAB 진입 시 해당 탭을 새 루트로 초기화하여 탭 전환 뒤 과거 이력 오염 방지
 * - TRANSIENT_ROUTES(충전 완료 결과 등)는 스택에 적재하지 않아 닫기 루프 방지
 * - 이미 스택에 존재하는 경로에 재진입하면 해당 지점까지 잘라내 사이클 원천 차단
 */
export function recordAppNav(pathname: string, mode: MobileRouteMode, fullHref?: string) {
  if (TRANSIENT_ROUTES.has(pathname)) return;
  const href = fullHref && stripQuery(fullHref) === pathname ? fullHref : pathname;

  if (mode === "ROOT_TAB") {
    navStack = [{ pathname, href }];
    return;
  }

  const existingIdx = navStack.findIndex((e) => e.pathname === pathname);
  if (existingIdx !== -1) {
    navStack = [...navStack.slice(0, existingIdx), { pathname, href }];
    return;
  }

  navStack.push({ pathname, href });
  if (navStack.length > MAX_STACK_LENGTH) {
    navStack = navStack.slice(-MAX_STACK_LENGTH);
  }
}

/** 현재 페이지 내 탭·반려견 필터 등 클라이언트 상태 변경 시 뒤로가기 복귀용 href를 동기화한다. */
export function updateCurrentNavHref(pathname: string, fullHref: string) {
  const idx = navStack.findIndex((e) => e.pathname === pathname);
  if (idx !== -1) {
    navStack[idx] = { pathname, href: fullHref };
  }
}

/**
 * 주문 완료 등 흐름 종착지에서 스택을 지정 루트(예: /app/shop)로 초기화해
 * 닫기(×) 시 이미 완료된 결제창으로 되돌아가는 루프를 방지한다.
 */
export function resetAppNavTo(rootHref: string) {
  navStack = [{ pathname: stripQuery(rootHref), href: rootHref }];
}

/**
 * 뒤로가기(<) / 닫기(×) 목적지 결정기 (무한 루프 원천 차단)
 * 1. forceBackHref: fallbackHref가 스택에 있으면 그 지점으로 절단, 없으면 [fallbackHref]로 단조 리셋
 * 2. 정상 내부 스택 존재: 현재 경로 이전 항목의 쿼리 포함 href로 Pop 복귀
 * 3. 푸시 딥링크 · URL 직접 진입 · 새로고침(스택 1개 이하): 현재 경로를 스택에서 제거하고
 *    [fallbackHref]로 리셋해 상위 계층 → 루트 탭까지 역류 없이 단조 하강한다.
 */
export function resolveAppBackTarget(
  currentPathname: string,
  fallbackHref: string,
  forceBackHref = false,
): string {
  const fallbackPathname = stripQuery(fallbackHref);
  const safeFallback =
    fallbackHref && fallbackPathname !== currentPathname ? fallbackHref : "/app";
  const safeFallbackPath = stripQuery(safeFallback);

  if (forceBackHref) {
    const existingIdx = navStack.findIndex((e) => e.pathname === safeFallbackPath);
    navStack =
      existingIdx !== -1
        ? navStack.slice(0, existingIdx + 1)
        : [{ pathname: safeFallbackPath, href: safeFallback }];
    markPendingScrollRestore(safeFallbackPath);
    return navStack[navStack.length - 1]?.href ?? safeFallback;
  }

  const currentIdx = navStack.findIndex((e) => e.pathname === currentPathname);
  if (currentIdx > 0) {
    navStack = navStack.slice(0, currentIdx);
    const prev = navStack[navStack.length - 1];
    if (prev && prev.pathname !== currentPathname) {
      markPendingScrollRestore(prev.pathname);
      return prev.href;
    }
  }

  // 직접 URL 진입 / 푸시 딥링크 / 새로고침 폴백: 현재 경로를 반드시 제거해 A ↔ B 핑퐁 루프 차단
  navStack = [{ pathname: safeFallbackPath, href: safeFallback }];
  markPendingScrollRestore(safeFallbackPath);
  return safeFallback;
}
