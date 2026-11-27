---
version: "3.3.0"
name: Waggle User Design System — Editorial Flat + Multi-Theme & Dark Mode (Default Favicon Orange)
description: >
  와글(Waggle) 사용자 영역(`apps/web`: `(www)` 소개페이지 + `(mobile)` `/app/*` 모바일 웹앱) 전용 디자인 시스템.
  관리자 콘솔(`DESIGN_ADMIN.md`)과 토큰·CSS·루트 rem을 100% 물리 분리 운영한다.
  기본 브랜드 컬러는 파비콘 주황(#EF8125)이며 `localStorage` 기반 2축 직교 구조(`data-web-theme`: `orange`·`green`·`sky`·`coral` × `data-web-mode`: `light`[기본]·`dark`)를 0ms FOUC로 지원한다.
  모든 치수는 선언된 rem 토큰 및 Tailwind v4 기본 rem 스케일(1rem = 16px 기준)만 사용한다.
colors:
  ink: "oklch(0.18 0.006 250)"
  ink-muted: "oklch(0.545 0.01 255)"
  canvas: "oklch(1 0 0)"
  surface: "oklch(1 0 0)"
  surface-subtle: "oklch(0.978 0.001 250)"
  border-subtle: "oklch(0.946 0.002 250)"
  brand: "oklch(0.715 0.172 54)"
  brand-strong: "oklch(0.715 0.172 54)"
  brand-soft: "oklch(0.964 0.032 62)"
  brand-stamp: "oklch(0.865 0.095 62)"
  on-brand: "oklch(1 0 0)"
  success: "oklch(0.68 0.175 150)"
  warning: "oklch(0.68 0.145 72)"
  destructive: "oklch(0.575 0.195 24)"
typography:
  display:
    fontFamily: Pretendard
    fontSize: 2.25rem
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: -0.03em
  body-md:
    fontFamily: Pretendard
    fontSize: 0.9375rem
    fontWeight: 400
    lineHeight: 1.55
  2xs:
    fontFamily: Pretendard
    fontSize: 0.6875rem
    lineHeight: 1rem
  3xs:
    fontFamily: Pretendard
    fontSize: 0.625rem
    lineHeight: 0.875rem
rounded:
  lg: 0.4375rem
  xl: 0.75rem
  2xl: 1rem
  btn-lg: 1.125rem
  3xl: 1.375rem
  full: 9999px
  cornerShape: "superellipse(1.3)"
spacing:
  xs: 0.25rem
  sm: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.25rem
  2xl: 1.5rem
  3xl: 2rem
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.btn-lg}"
    height: 3rem
  button-secondary:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.ink}"
    rounded: "{rounded.btn-lg}"
    height: 3rem
  input-underline:
    borderBottom: "{colors.border-subtle}"
    focusDrawBar: "{colors.brand}"
    height: 2.75rem
  modal-center:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.3xl}"
    maxWidth: 22.5rem
---

# Waggle User Design System — Editorial Flat + Single Waggle Green (`(www)` · `(mobile)`)

> **적용 범위:** `apps/web` 사용자 영역 전용 (`(www)` 소개페이지 + `(mobile)` `/app/*` 모바일 웹앱 — 관리자 `(admin)` `styles/admin.css`와 100% 물리 분리)  
> **테마 파일 위치:** `apps/web/src/styles/web.css` (`(www)/layout.tsx` · `(mobile)/layout.tsx` 전용 import)  
> **공용 UI 키트:** `apps/web/src/components/web/ui/` (8개 모듈 100% 일괄 관리)  
> **상위 라우터:** [DESIGN.md](./DESIGN.md) | **모바일 쉘 규격:** [APP_SHEET_FRAME_GUIDE.md](./APP_SHEET_FRAME_GUIDE.md)

---

## Overview

와글 사용자 앱(`apps/web`)은 **Toss / iOS Editorial Flat (순백 캔버스 90% + 극절제 쿨그레이) + 단일 시그니처 Waggle Green (10%)** 체계를 따릅니다.

- **다색 파스텔 및 3단 박스 중첩 전면 폐기**: 화면당 1개 시그니처 그린(`brand`)과 무채색 타이포/구분선(`divide-y border-border-subtle`) 위계로 정보 밀도와 가독성을 극대화합니다.
- **REM-Only & 선언 토큰 전용**: 컴포넌트에서 임의 `px` 및 `text-[...]` 임의값 사용을 금지하고, `web.css` `@theme`에 선언된 `rem` 토큰과 Tailwind v4 표준 스케일만 사용합니다.
- **전 화면 1곳 수정 일괄 반영**: 버튼·입력·달력·셀렉트·세그먼트·체크박스/스위치·선택카드/칩·중앙 모달은 모두 `apps/web/src/components/web/ui/` 공용 컴포넌트를 통해서만 조립합니다.

---

## Colors & Tailwind v4 `@theme` (`apps/web/src/styles/web.css`)

| 토큰명 | 역할 | `oklch(L C H)` | 명암비 기준 |
| :--- | :--- | :--- | :--- |
| `--color-ink` | 주 텍스트 · CTA 글자 · 하단바 활성 Solid 아이콘 | `oklch(0.18 0.006 250)` | on `surface` **18.5:1 (AAA)** |
| `--color-ink-muted` | 보조 설명 · 플레이스홀더 · 캡션 | `oklch(0.545 0.01 255)` | on `surface` **5.4:1 (AA+)** |
| `--color-canvas` | 페이지 기본 배경 (순백) | `oklch(1 0 0)` | - |
| `--color-surface` | 모달·시트·카드 표면 (순백) | `oklch(1 0 0)` | - |
| `--color-surface-subtle` | 무경계 초경량 쿨그레이 면 (트랙·비선택 카드·보조 버튼) | `oklch(0.978 0.001 250)` | text `ink` **17.6:1 (AAA)** |
| `--color-border-subtle` | 1px 구분선·언더라인 기본선 | `oklch(0.946 0.002 250)` | hairline divider |
| `--color-brand` | **기본 시그니처 Waggle Orange (`#EF8125`)** (Primary CTA · 활성 체크 · 진도바) | `oklch(0.705 0.175 56)` | `data-web-theme` 4종(`orange`·`green`·`sky`·`coral`) 전환 |
| `--color-brand-strong` | 텍스트·배지용 고대비 번트 오렌지 (흰 배경 위 가독성 확보) | `oklch(0.555 0.165 48)` | on `surface` **AA+** |
| `--color-brand-soft` | 선택 카드·활성 배지용 소프트 틴트 | `oklch(0.964 0.032 62)` | text `brand-strong` |
| `--color-brand-stamp` | 캘린더 발바닥 도장(`PawStampIcon`) 파스텔 채움 | `oklch(0.865 0.095 62)` | 테마별 자동 연동 |
| `--color-success` | 성공 상태 | `oklch(0.68 0.175 150)` | accent |
| `--color-warning` | 주의 상태 | `oklch(0.68 0.145 72)` | accent |
| `--color-destructive` | 삭제·오류·차감 | `oklch(0.575 0.195 24)` | on-destructive `surface` **AA** |

---

## Typography & Tight Radius Tokens (`apps/web/src/styles/web.css`)

| 토큰 / 클래스 | `rem` 값 | 용도 |
| :--- | :---: | :--- |
| `text-display` | `2.25rem` | `(www)` 히어로 헤드라인 |
| `text-body-md` | `0.9375rem` | 앱 본문·인풋·CTA 기본 |
| `text-2xs` (`--text-2xs--line-height: 1rem`) | `0.6875rem` | 뱃지·태그·보조 메타 |
| `text-3xs` (`--text-3xs--line-height: 0.875rem`) | `0.625rem` | 하단 탭바 라벨(`font-medium` 고정, bold 금지) |
| `rounded-lg` / `xl` / `2xl` / `3xl` | `0.375` / `0.5` / `0.625` / `0.875rem` | 체크박스(`lg`), 칩(`xl`), CTA·카드(`2xl`), 모달·세그먼트 외곽(`3xl`) |

- 모든 동적 수치(포인트·금액·진도율·날짜·체중)에 `tabular-nums` 필수.

---

## 공용 UI 키트 & 마이크로 인터랙션 (`apps/web/src/components/web/ui/`)

1. **`AppButton` / `AppLinkButton` (`buttonStyles.ts`)**: `primary`(Waggle Green + `text-surface font-bold`), `secondary`, `outline`, `ghost`, `danger`, `dangerSolid` + 로딩 스피너 + `active:scale-[0.98]`.
2. **`AppBadge`**: 모던 사각(`rounded-lg`) 5-tone(`brand`·`brandSolid`·`neutral`·`ink`·`danger`), `sm`/`md` 공용 배지.
3. **`AppInput` / `AppTextarea`**: Toss 언더라인 스타일 — 포커스 시 하단 `h-0.5` Waggle Green 라인이 **`origin-left scale-x-0 → scale-x-100`** (`250ms cubic-bezier(0.22, 1, 0.36, 1)`)으로 왼쪽→오른쪽 드로잉 + 상단 라벨 `text-brand-strong` 전환.
4. **`AppCenterModal`**: `createPortal(..., document.body)` `z-50` 정중앙 플로팅 모달 + `useModalHistory` + ESC/스크롤 잠금 + `animate-modal-pop`.
5. **`AppDatePicker`**: 숫자 직접 입력(`YYYY.MM.DD` 자동 포맷, `inputMode="numeric"`) + 정중앙 모달 달력(년/월/일 3단 그리드 전환 · 6주 42칸 + 본문 `h-68` 고정 높이로 점프 0 · 하단 `[오늘]`·`[취소]`·`[확인]`).
6. **`AppTimePicker`**: Toss 언더라인 트리거 + 정중앙 모달 **3열 iOS 드럼 스크롤 휠**(오전/오후 · 1~12시 · 00~59분 1분 단위, 순수 CSS `scroll-snap-type: y mandatory`, Fluid REM 동적 높이 측정).
7. **`AppSelectPicker`**: Toss 언더라인 트리거 + 정중앙 모달 리스트(`searchable` 시 리스트 `h-72` 고정 높이로 검색 점프 0).
8. **`AppSegmented`**: 외곽 `rounded-3xl` + 내부 `rounded-2xl` 동심원 + 버튼 간 `0.25rem` 간격 + `translateX(activeIndex * 100%)` 좌우 슬라이딩 + 비선택 항목 옅은 쿨그레이 호버 프리뷰(`hover:bg-ink/[0.045]`).
9. **`AppCheckbox` / `AppSwitch`**:
   - `AppCheckbox`: 무경계 쿨그레이 면 채움(`bg-ink/[0.09]`) → 체크 시(`false → true` 클릭 전용) 박스 탄성 팝 + 체크(`✓`) SVG 획 그리기(`pathLength=1`) + 박스 외곽 6방향 짧은 시차 빛남 라인(`viewBox="0 0 40 40"`).
   - `AppSwitch`: OFF `bg-ink/[0.12]` · 스프링 이징 + 프레스 탄성(`group-active:w-6`) 슬라이딩 그린 토글 스위치.
10. **`AppChoiceCard` / `AppChip`**: 설문·레벨테스트·퀴즈·충전 패키지·상품 옵션·데일리 스티커·요일 프리셋 공용 선택 UI.
11. **`BottomNavBar` (`.waggle-liquid-glass`)**:
   - 불투명 하단 가림막 없는 순수 반투명 리퀴드 글래스(`66%` surface + `blur(22px) saturate(180%)` + 상단 반사 림 `inset 0 1px 0`).
   - 5탭 전용 Outline(`1.4px`) ↔ **꽉 찬 검정 Solid SVG**(`size-5.5`) + `text-3xs font-medium` 라벨(`gap-0.5`) + `translateX` 좌우 슬라이딩 캡슐(`bg-ink/[0.075]`).
