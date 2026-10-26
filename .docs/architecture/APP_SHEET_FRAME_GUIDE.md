# AppSheetFrame & Global Overlay Navigation 표준 가이드

> **문서 상태:** 활성 (Active SSOT)  
> **적용 범위:** 와글(Waggle) `apps/web` 내 모든 서브 화면, 슬라이드 시트, 바텀시트, 온보딩, 상세 뷰 및 430px 모바일 앱 프레임

---

## 1. 도입 배경 및 철학 (KISS & Single Source of Layout)

모바일 웹앱에서 화면마다 개별적으로 `fixed inset-0`, 인라인 패딩, safe-area(`pt-safe`, `pb-safe`), 헤더 높이를 따로 작성하면서 발생하는 문제를 원천 차단하기 위해 **430px 모바일 프레임 + 0ms 네이티브 오버레이(`GlobalOverlayProvider`) + 3단 쉘(`AppSheetFrame`) + 3중 히스토리 가드(`useModalHistory`)**로 아키텍처를 일원화합니다.

---

## 2. 430px 앱 프레임 & 0ms 좌우/상하 스와이프 오버레이 아키텍처

### 2.1 기본 430px 뷰포트 컨테이너 (`Base Layout`)
```
+-------------------------------------------------------------+
| [430px Frame Container] (max-w-[430px] mx-auto min-h-[100dvh])|
|                                                             |
| 1. Top Header Bar (h-[56px], z-20)                           |
| 2. Main Scrollable Content Area (flex-1, pb-24, z-10)        |
| 3. Fixed Bottom Navigation Bar (z-30)                        |
+-------------------------------------------------------------+
```
- **컨테이너 클래스**: `max-w-[430px] w-full mx-auto min-h-[100dvh] bg-theme-app relative overflow-x-hidden shadow-2xl`

### 2.2 전역 Z-Index 계층 스택 (`Z-Index Stacking Context`)

| Z-Index 계층 | 레이어 명칭 | 구성 요소 및 설명 |
|---|---|---|
| **`z-0`** | **Background Layer** | 배경 캔버스 및 장식 레이어 |
| **`z-10`** | **Main Content Layer** | 메인 대시보드/탭 본문 콘텐츠 |
| **`z-20`** | **Sticky Header Layer** | 상단 고정 앱 헤더 (`TopHeader`) |
| **`z-30`** | **Bottom Nav Layer** | 하단 고정 GNB 탭바 (`BottomNavBar`) |
| **`z-40`** | **1차 전역 오버레이 (Page Sheet)** | `GlobalOverlayProvider` 1차 슬라이드/바텀시트 모달 |
| **`z-45`** | **2차 중첩 오버레이 (Sub-Page Sheet)** | 1차 시트 위에서 열리는 2차 상세 시트 |
| **`z-50`** | **In-Modal Dropdown & Popovers** | 시트 내부 드롭다운, 바텀 팝오버, 툴팁 |
| **`z-60`** | **최상위 시스템 팝업 (Global Alert)** | `GlobalAlert` / `GlobalPopupProvider` (Confirm/Alert 모달) |
| **`z-70`** | **최상위 토스트 (Toast/Banner)** | 글로벌 토스트 알림, 오프라인 배너 |

### 2.3 0ms 네이티브 오버레이 전환 (`GlobalOverlayProvider`)
라우트 전체를 언마운트하지 않고 대시보드가 100% 렌더링된 채로 유지되는 Framer Motion 전역 오버레이 방식을 사용합니다.
- **좌우 슬라이드 (`x: "100%" -> 0`)**: 일반 서브 페이지, 상세 화면, 설정 시트
- **상하 바텀시트 (`y: "100%" -> 0`)**: 필터, 빠른 입력, 액션 시트

```tsx
// GlobalOverlayProvider: 430px 마스킹 프레임 내부에서만 x: 100% -> 0 또는 y: 100% -> 0 슬라이드
<motion.div
  style={{ zIndex: 40 + index * 5 }}
  className="fixed inset-0 max-w-[430px] mx-auto flex items-end justify-center pointer-events-none overflow-hidden"
>
  {/* 백드롭 */}
  <motion.div
    className="absolute inset-0 bg-black/15 backdrop-blur-md z-0 pointer-events-auto"
    onClick={closeModal}
  />
  {/* 본문 시트 */}
  <motion.div
    initial={isSlideUp ? { y: "100%" } : { x: "100%" }}
    animate={isSlideUp ? { y: 0 } : { x: 0 }}
    exit={isSlideUp ? { y: "100%" } : { x: "100%" }}
    transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.9 }}
    className="w-full h-full bg-theme-app relative overflow-y-auto no-scrollbar pointer-events-auto z-10"
  >
    {modal.content}
  </motion.div>
</motion.div>
```

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
3. **풀-블리드(화면 양 끝 확장) 처리**: 지도(산책 트래킹), 이미지 배너, 가로 칩바 스크롤 등 화면 좌우 끝까지 채워야 할 때는 `noPadding={true}`를 선언하고 내부 텍스트 블록에만 개별 `px-4`를 부여합니다.

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

### 4.2 [Layer 2] History Lock 커스텀 훅 (`useModalHistory.ts`)
```typescript
import { useEffect, useRef } from "react";

interface UseModalHistoryOptions {
  isOpen: boolean;
  onClose: () => void;
  modalId?: string;
}

export function useModalHistory({ isOpen, onClose, modalId = "global-modal" }: UseModalHistoryOptions) {
  const isPushedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      isPushedRef.current = false;
      return;
    }

    window.history.pushState({ modalOpen: true, modalId }, "");
    isPushedRef.current = true;

    const handlePopState = () => {
      isPushedRef.current = false;
      onClose();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (isPushedRef.current && window.history.state?.modalOpen) {
        isPushedRef.current = false;
        window.history.back();
      }
    };
  }, [isOpen, onClose, modalId]);
}
```

### 4.3 [Layer 3] 모달 닫힘 시 리소스 클린업 의무화 (Teardown on Close)
시트가 닫히거나 언마운트될 때 내부에서 실행 중이던 모든 `setInterval`, `setTimeout`, `requestAnimationFrame`, GPS 위치 추적(`watchPosition`), 오디오/비디오 스트림은 `useEffect` cleanup에서 100% 즉시 해제해야 합니다.
