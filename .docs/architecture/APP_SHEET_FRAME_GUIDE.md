# AppSheetFrame & Global Overlay Navigation 표준 가이드

> **문서 상태:** 활성 (Active SSOT)  
> **적용 범위:** 와글(Waggle) `apps/web` 내 모든 서브 화면, 슬라이드 시트, 바텀시트, 온보딩, 상세 뷰 및 440px 앱 전용 프레임

---

## 1. 도입 배경 및 철학 (KISS & Single Source of Layout)

모바일 웹앱에서 화면마다 개별적으로 `fixed inset-0`, 인라인 패딩, safe-area(`pt-safe`, `pb-safe`), 헤더 높이를 따로 작성하면서 발생하는 문제를 원천 차단하기 위해 **440px(Fluid REM) 앱 전용 프레임 + 0ms 네이티브 오버레이(`GlobalOverlayProvider`) + 3단 쉘(`AppSheetFrame`) + 3중 히스토리 가드(`useModalHistory`)**로 아키텍처를 일원화합니다.

---

## 2. 440px 앱 프레임 (Fluid REM) & 0ms 좌우/상하 스와이프 오버레이 아키텍처

### 2.1 기본 440px 뷰포트 컨테이너 & Fluid REM 반응형 (`Base Layout`)
```
+-------------------------------------------------------------+
| [440px Frame Container] (w-full max-w-[440px] mx-auto min-h-dvh)|
|                                                             |
| 1. Top Header Bar (h-[3.5rem], z-20)                         |
| 2. Main Scrollable Content Area (flex-1, pb-24, z-10)        |
| 3. Fixed Bottom Navigation Bar (z-30)                        |
+-------------------------------------------------------------+
```
- **컨테이너 클래스**: `waggle-app-shell relative mx-auto flex min-h-dvh w-full max-w-app flex-col overflow-x-clip bg-canvas sm:h-dvh sm:min-h-0 sm:overflow-x-hidden sm:overflow-y-auto sm:overscroll-y-contain sm:shadow-2xl sm:ring-1 sm:ring-ink/[0.08]`
- **반응형 하이브리드 스크롤 (`styles/web.css` · `MobileShellMain` · `useModalHistory`)**:
  - **실모바일(`< 640px`)**: 네이티브 `window` 스크롤을 유지해 iOS Safari/Android Chrome 주소창 자동 숨김, 상태바 탭 최상단 이동, Pull-to-Refresh를 100% 보존합니다.
  - **데스크톱(`≥ 640px`)**: `html`/`body`를 `h-dvh overflow-hidden`으로 잠그고 440px 앱 프레임(`.waggle-app-shell`) 내부에서 스크롤바를 숨긴 채(`scrollbar-width: none`) 스크롤합니다. 전진 이동 시 `scrollTop = 0` 리셋, 뒤로가기(`<`/`×`/`popstate`) 시 `mobileNavHistory`에 저장된 이전 스크롤 위치를 복원하며, `useModalHistory`는 `html[data-scroll-locked="true"]` 단일 속성으로 스크롤 잠금을 제어합니다.
- **440px 기준 Fluid REM 스케일링 (`/app` 전용 스코프 격리 — `globals.css`)**:
  - `(www)` 소개페이지(`16px` 기본 반응형)와의 충돌을 방지하기 위해 `html:has([data-waggle-app]) { font-size: clamp(12.5px, 3.6364vw, 16px); }`처럼 `/app` 레이아웃 내부에만 스코핑합니다.
  - 기본 기준 폭 `440px`에서 `1rem = 16px`이며, `440px` 미만 기기에서는 전체 UI가 `rem` 단위로 1:1 정비례 축소됩니다.
  - 따라서 컴포넌트 작성 시 하드코딩 `px` 대신 **Tailwind `rem` 기반 유틸리티(`p-4`, `h-14`, `text-base`, `rounded-2xl` 등)**를 사용해야 화면 폭이 줄어들 때 자동으로 반응형 축소됩니다.

### 2.2 전역 Z-Index 계층 스택 (`Z-Index Stacking Context`)

| Z-Index 계층 | 레이어 명칭 | 구성 요소 및 설명 |
|---|---|---|
| **`z-0`** | **Background Layer** | 배경 캔버스 및 장식 레이어 |
| **`z-10`** | **Main Content Layer** | 메인 대시보드/탭 본문 콘텐츠 (`MobileShellMain`) |
| **`z-20`** | **Sticky Header Layer** | 상단 고정 앱 헤더 (`MobileTopHeader` — 5대 탭 전용 / `SubPageHeader` — 서브 페이지 최상단 단독 고정) |
| **`z-30`** | **Bottom Nav Layer** | 하단 고정 플로팅 5탭 바 (`BottomNavBar` — 5대 탭 전용) |
| **`z-40`** | **1차 전역 오버레이 (Background-Preserving Sheet)** | `GlobalOverlayProvider` 슬라이드업 시트 (**Max Depth = 1**, 중복 적재 금지·교체만 허용) |
| **`z-50`** | **중앙 피커 모달 (`AppCenterModal`)** | 날짜(`AppDatePicker`) · 시간(`AppTimePicker`) · 선택(`AppSelectPicker`) 모달 |
| **`z-60`** | **최상위 시스템 팝업 (Global Alert)** | `WebGlobalAlert` (`closeOnOverlayClick={false}`, `closeOnEscape={false}`) |
| **`z-70`** | **최상위 토스트 (Toast/Banner)** | 글로벌 토스트 알림, 오프라인 배너 |

### 2.3 0ms 배경 유지 슬라이드업 시트 (`GlobalOverlayProvider`) & 38화면 라우트 전환
- **라우트 프레젠테이션 4분류 & Next.js 16 네이티브 ViewTransition (`00_lib/mobileRoutePresentation.ts`, `MobileViewTransitionShell.tsx`)**:
  - `next.config.ts`의 `experimental.viewTransition: true` + React 19.3 `<ViewTransition>` + `<AppLink>`/`<AppLinkButton>` 자동 방향 주입으로 전 화면 GPU 합성 전환을 제공합니다.
  - `ROOT_TAB` 5개(`/app`, `/app/record`, `/app/daily`, `/app/shop`, `/app/my`): 상단 `Waggle` 헤더 + 하단 5탭 바 표시, `key="root-tabs"` 유지로 하단 바 리마운트 차단, 직계 블록 순차 상승 모션(`.waggle-stagger`, `backwards` 전용).
  - `BRAND_FLOW` 6개: 심플 브랜드 헤더만 표시 (온보딩 인트로·로그인·설문·결과).
  - `MODAL_PAGE` 11개(주문·배송 조회, 장바구니, 주문/결제, 포인트 지갑, 알림함, 레슨 1~3단계 실행, 직접 URL 폼): 상/하단 메뉴 숨김, `SubPageHeader` **우상단 `×` 닫기** + 담백 상하 덮기/내리기 ViewTransition(`waggle-modal-up`/`waggle-modal-down`, `300ms`/`260ms`).
  - `SUB_PUSH` 16개(상품 상세, 코스·레슨 개요, Q&A 목록/상세, 반려견·목표·설정 등): 상/하단 메뉴 숨김, `SubPageHeader` **좌상단 `←` 뒤로가기** + iOS 패럴랙스 좌우 Push/Pop ViewTransition(`waggle-push-forward`/`waggle-push-back`, `320ms`/`280ms`).
- **스마트 뒤로가기 & 푸시 딥링크 무순환 가드 (`00_lib/mobileNavHistory.ts` + `SubPageHeader.tsx`)**:
  - 현재 SPA 세션 메모리 기반 무순환(Cycle-Free) 이동 스택(`ROOT_TAB` 진입 시 초기화, 동일 경로 재진입 시 `indexOf` 절단)을 유지해 다중 진입 화면에서도 `<`/`×` 클릭 시 직전 출발 화면으로 `router.replace(target, { scroll: false, transitionTypes })` 역방향 ViewTransition 복귀합니다.
  - 푸시 딥링크·주소창 직접 URL 진입·새로고침·`forceBackHref` 폴백 시에는 `resolveAppBackTarget`이 현재 경로를 스택에서 제거하고 `[fallbackHref]`로 단조 리셋하여 상위 화면 → 루트 탭까지 `A ↔ B` 무한 루프 없이 안전하게 빠져나옵니다.
- **배경 유지 시트 5종 (`GlobalOverlayProvider`, `z-40`, Max Depth = 1)**:
  - 일기 작성(`/app/daily`), 상품 옵션·수량(`/app/shop/products/[id]`), 포인트 충전(`/app/wallet`), 영상 Q&A 작성(`/app/inquiry`), 반려견 추가(`/app/my/dogs`)는 뒤 화면을 어둡게 유지(`bg-ink/35`)한 채 순수 CSS `animate-sheet-up`으로 오픈합니다.
  - 시트 내부에서 `router.push()` 실행 시 `useModalStore.getState().dismissForNavigation()`을 호출하고, `usePathname()` 변경 시 잔여 시트를 자동 해제하여 `history.back()` 충돌을 원천 차단합니다.

---

## 3. `AppSheetFrame` 3단 슬롯 아키텍처 (Three-Tier Slot Architecture)

```
┌────────────────────────────────────────────────────────┐
│ 1. HEADER (상단 고정 슬롯: SubPageHeader / BrandLogo)   │  <- headerMode="fixed" (기본)
│    - SUB-HEADER (진행 게이지 바, 세그먼트 탭, 칩바 등)  │  <- subHeader 슬롯
├────────────────────────────────────────────────────────┤
│                                                        │
│ 2. CONTENT (본문 가변 스크롤 영역: <main>)              │  <- flex-1 min-h-0 overflow-y-auto
│    - align="top"    : 일반 목록, 폼 위저드               │  <- overscroll-x-none [touch-action:pan-y]
│    - align="center" : 인트로/완료/중앙 정렬 뷰           │
│    - noPadding=true : 풀-블리드 화면                     │
│                                                        │
├────────────────────────────────────────────────────────┤
│ 3. BOTTOM (하단 고정 푸터: CTA 버튼 슬롯)                │  <- bottomMode="flow" (기본)
│    - pb-safe-bottom 단일 통합 제어 (노치 잘림 0%)       │  <- backdrop-blur-md 도킹 바
└────────────────────────────────────────────────────────┘
```

### 3.1 Props 인터페이스 명세

```typescript
export interface AppSheetFrameProps {
  /** 1. 상단 헤더 영역 (SubPageHeader 등) */
  header?: React.ReactNode;
  /** 헤더 배치 모드 ('fixed': 상단 고정, 'flow': 본문과 함께 스크롤) */
  headerMode?: "fixed" | "flow";
  /** 2. 상단 헤더 바로 밑 서브 고정 영역 (진행 게이지 바, 세그먼트 탭, 칩바 등) */
  subHeader?: React.ReactNode;
  /** 3. 본문 컨텐츠 */
  children: React.ReactNode;
  /** 본문 수직 정렬 모드 ('top' | 'center') */
  align?: "top" | "center";
  /** 본문 패딩 제거 및 풀-블리드(Full-Bleed) 모드 활성화 (기본값: false) */
  noPadding?: boolean;
  /** 4. 하단 고정 푸터 영역 (선택: CTA 버튼, 컨트롤러) */
  bottom?: React.ReactNode;
  /** 하단 푸터 렌더 모드 ('flow': 자연 도킹, 'fixed': absolute 플로팅) */
  bottomMode?: "flow" | "fixed";
  className?: string;
  contentClassName?: string;
  bottomClassName?: string;
}
```

### 3.2 핵심 준수 규칙
1. **자식 컴포넌트 내부에 개별 `fixed/absolute` 하단 버튼 금지**: 하단 CTA 버튼은 반드시 `AppSheetFrame`의 `bottom` 슬롯으로 주입합니다.
2. **`pt-safe`와 `pb-safe`의 개별 하드코딩 금지**: 상하단 노치 안전 영역은 `AppSheetFrame`이 단일 제어합니다.
3. **풀-블리드(화면 양 끝 확장) 처리**: 교육 영상 플레이어, 히어로 이미지 배너, 가로 칩바 스크롤 등 화면 좌우 끝까지 채워야 할 때는 `noPadding={true}`를 선언하고 내부 텍스트 블록에만 개별 `px-4`를 부여합니다.

---

## 4. 모바일 스와이프 & 물리 뒤로가기 3중 방어 (`Triple-Lock Strategy`)

모달/시트가 열렸을 때 **iOS Edge Swipe 이탈** 및 **Android 물리 뒤로가기 클릭 시 빈 화면 이동**을 원천 차단합니다.

### 4.1 [Layer 1] CSS 전역 제스처 차단 (`globals.css`)
```css
html, body {
  overscroll-behavior-x: none;
  touch-action: pan-y; /* 상하 스크롤만 허용, 좌우 엣지 스와이프 브라우저 뒤로가기 차단 */
}
```

### 4.2 [Layer 2] 단일 LIFO History / ESC / Scroll-Lock 매니저 (`02_hooks/useModalHistory.ts`)
- 시트(`z-40`) → 중앙 피커(`z-50`) → 시스템 Alert(`z-60`) 중첩 시 **단일 전역 LIFO 스택(`layerStack`)**으로 `popstate`, `Escape`, `document.body.style.overflow`를 통합 제어합니다.
- 버튼 클릭으로 상위 모달을 닫을 때 발생하는 비동기 `popstate`는 `ignorePopCount`로 흡수하여 부모 시트가 연쇄 닫히는 버그를 원천 차단합니다.
- 시트 내부에서 `router.push()` 실행 직전 `skipLayerHistoryBack()`(`useModalStore.dismissForNavigation()`)을 호출하여 `history.back()`이 내비게이션을 취소하지 않도록 보호합니다.

### 4.3 [Layer 3] 모달 닫힘 시 리소스 클린업 의무화 (Teardown on Close)
시트가 닫히거나 언마운트될 때 내부에서 실행 중이던 모든 `setInterval`, `setTimeout`, `requestAnimationFrame`, GPS 위치 추적(`watchPosition`), 오디오/비디오 스트림은 `useEffect` cleanup에서 100% 즉시 해제해야 합니다.
