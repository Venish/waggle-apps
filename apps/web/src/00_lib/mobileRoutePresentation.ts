export type MobileRouteMode = "ROOT_TAB" | "BRAND_FLOW" | "MODAL_PAGE" | "SUB_PUSH";

export interface MobileRoutePresentation {
  mode: MobileRouteMode;
  showTopHeader: boolean;
  simpleTopHeader: boolean;
  showBottomNav: boolean;
  headerMode: "push" | "modal";
  transition: "root" | "fade" | "slide-up" | "slide-right";
}

const ROOT_TABS = new Set(["/app", "/app/record", "/app/daily", "/app/shop", "/app/my"]);

const BRAND_FLOW_EXACT = new Set([
  "/app/onboarding",
  "/app/onboarding/intro",
  "/app/onboarding/login",
  "/app/onboarding/signup",
  "/app/onboarding/extra",
  "/app/onboarding/profile",
  "/app/onboarding/result",
  "/app/onboarding/survey",
]);

/**
 * 어디서든 잠깐 열어 확인·실행하고 닫는 독립 창(× 우상단 · 하→상 전환)
 * - 주문·배송 조회, 장바구니, 포인트 지갑, 알림함, 직접 URL 폼
 * - /app/shop/checkout은 장바구니·상품상세에서 이어지는 단계 진입이므로 SUB_PUSH(←)로 처리
 */
const MODAL_PAGE_EXACT = new Set([
  "/app/shop/orders",
  "/app/shop/cart",
  "/app/wallet",
  "/app/wallet/recharge",
  "/app/my/notifications",
  "/app/inquiry/new",
]);

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/**
 * (mobile) /app/* 38화면 프레젠테이션 분류기
 * - ROOT_TAB (5): 메인 상단 Waggle 헤더 + 하단 5탭 바 유지 (블록별 .waggle-stagger)
 * - BRAND_FLOW (6): 심플 브랜드 헤더만 표시 (온보딩 인트로·로그인·설문·결과)
 * - MODAL_PAGE (11): 독립 조회·결제·레슨 실행·직접 URL 폼 (상/하단 메뉴 숨김 + 우상단 × + 하→상 전환)
 * - SUB_PUSH (16): 계층 드릴다운 상세/관리 페이지 (상/하단 메뉴 숨김 + 좌상단 ← + 우→좌 전환)
 */
export function getMobileRoutePresentation(rawPathname: string): MobileRoutePresentation {
  const pathname = normalizePath(rawPathname);

  if (ROOT_TABS.has(pathname)) {
    return {
      mode: "ROOT_TAB",
      showTopHeader: true,
      simpleTopHeader: false,
      showBottomNav: true,
      headerMode: "push",
      transition: "root",
    };
  }

  if (BRAND_FLOW_EXACT.has(pathname) || pathname.startsWith("/app/onboarding/survey/")) {
    return {
      mode: "BRAND_FLOW",
      showTopHeader: true,
      simpleTopHeader: true,
      showBottomNav: false,
      headerMode: "push",
      transition: "fade",
    };
  }

  const isLessonImmersion =
    pathname.startsWith("/app/lesson/") &&
    (pathname.endsWith("/watch") || pathname.endsWith("/practice") || pathname.endsWith("/quiz"));

  const isDailyDirectEditor = pathname.startsWith("/app/daily/");

  if (MODAL_PAGE_EXACT.has(pathname) || isLessonImmersion || isDailyDirectEditor) {
    return {
      mode: "MODAL_PAGE",
      showTopHeader: false,
      simpleTopHeader: false,
      showBottomNav: false,
      headerMode: "modal",
      transition: "slide-up",
    };
  }

  return {
    mode: "SUB_PUSH",
    showTopHeader: false,
    simpleTopHeader: false,
    showBottomNav: false,
    headerMode: "push",
    transition: "slide-right",
  };
}

/**
 * 목적지 href 기준으로 Next.js 16 ViewTransition 방향 타입을 자동 판별한다.
 * - SUB_PUSH 목적지 → ["waggle-push-forward"] (우→좌 패럴랙스 Push)
 * - MODAL_PAGE 목적지 → ["waggle-modal-up"] (하→상 담백 덮기)
 * - ROOT_TAB / BRAND_FLOW / 외부 URL → undefined (5대 탭 .waggle-stagger 및 기본 동작 유지)
 */
export function getMobileForwardTransitionTypes(href: string): string[] | undefined {
  if (!href.startsWith("/app")) return undefined;
  const pathnameOnly = href.split(/[?#]/)[0] ?? href;
  const { mode } = getMobileRoutePresentation(pathnameOnly);
  if (mode === "SUB_PUSH") return ["waggle-push-forward"];
  if (mode === "MODAL_PAGE") return ["waggle-modal-up"];
  return undefined;
}
