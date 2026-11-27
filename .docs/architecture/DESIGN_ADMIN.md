---
version: "2.6.0"
name: Waggle Admin Design System — Atlas Precision Studio
description: >
  와글(Waggle) 운영 관리자 콘솔(`apps/web` `(admin)` Route Group — 추후 `apps/admin` 분리 대비) 전용 디자인 시스템.
  사용자 디자인(`DESIGN_WEB.md`, `styles/web.css`)과 독립 Root Layout · 전용 CSS(`styles/admin.css`) · 루트 rem을 100% 물리 분리한다.
  루트 rem은 브라우저 표준 16px(1rem = 16px, --spacing: 0.25rem)로 고정하며,
  컴포넌트에서는 선언된 rem 토큰 및 Tailwind v4 기본 유틸리티 클래스만 사용한다.
colors:
  gray-50: "#FDFDFC"
  gray-100: "#F5F5F4"
  gray-200: "#E2E1DF"
  gray-300: "#CDCCC9"
  gray-400: "#A4A29E"
  gray-500: "#7A7873"
  gray-600: "#595753"
  gray-700: "#403E3B"
  gray-800: "#2A2927"
  gray-900: "#1A1918"
  gray-950: "#0E0D0C"
  surface-dark-1: "{colors.gray-950}"
  surface-dark-2: "{colors.gray-900}"
  surface-dark-3: "{colors.gray-900}"
  surface-light-1: "{colors.gray-50}"
  surface-light-2: "{colors.gray-100}"
  surface-light-3: "#FFFFFF"
  info: "#2A7BF6"
  positive: "#229A63"
  warning: "#C97A00"
  negative: "#D94436"
typography:
  heading-2xl:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: -0.025em
  heading-xl:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: -0.025em
  drawer-title:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: -0.01em
  dialog-title:
    fontFamily: Inter
    fontSize: 0.9375rem
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: -0.01em
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.429
    letterSpacing: 0em
  control-md:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: 450
    lineHeight: 1
    letterSpacing: 0em
  table-head:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.333
    letterSpacing: 0em
  sidebar-group:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: 0em
rounded:
  checkbox: 0.375rem
  badge: 0.375rem
  btn-sm: 0.625rem
  control: 0.625rem
  menu: 0.75rem
  nav-item: 0.875rem
  panel: 1rem
  btn-lg: 1.125rem
  auth: 1.25rem
  search-hero: 1.375rem
  full: 9999px
  cornerShape: "superellipse(1.3)"
spacing:
  unit: 0.25rem
  xs: 0.375rem
  sm: 0.5rem
  md: 0.625rem
  lg: 0.75rem
  xl: 0.875rem
  2xl: 1rem
  3xl: 1.5rem
components:
  button-sm:
    rounded: "{rounded.r2_5}"
    height: 1.5rem
    padding: 0.5rem
  button-md:
    backgroundColor: "{colors.gray-50}"
    textColor: "{colors.gray-900}"
    typography: "{typography.control-md}"
    rounded: "{rounded.r3}"
    height: 1.75rem
    padding: 0.625rem
  button-lg:
    rounded: "{rounded.r3_5}"
    height: 2rem
    padding: 0.875rem
  input-md:
    backgroundColor: "{colors.gray-950}"
    textColor: "{colors.gray-50}"
    rounded: "{rounded.r3}"
    height: 1.75rem
    padding: 0.625rem
  badge:
    rounded: "{rounded.r2}"
    height: 1.25rem
    padding: 0.375rem
  dialog:
    backgroundColor: "{colors.gray-900}"
    rounded: "{rounded.r4}"
    padding: 1rem
---

# Waggle Admin Design System — Atlas Precision Studio (`(admin)`)

> **적용 범위:** `apps/web` `(admin)` Route Group (`/admin/*`, 운영 관리자 `ADMIN` 콘솔 + 훈련사 `TRAINER` 포털 — 추후 `apps/admin` 분리 시 1:1 이식)  
> **테마 파일 위치:** `apps/web/src/styles/admin.css` (`(admin)/layout.tsx` 독립 Root Layout 전용 import — 사용자 `styles/web.css` 및 Fluid REM과 100% 물리 분리)  
> **루트 `rem` 기준:** `html { font-size: 16px; }` 고정 (`1rem = 16px`, `--spacing: 0.25rem`). 컴포넌트 내 임의 `px` arbitrary 금지 — **Tailwind v4 기본 `rem` 유틸리티와 아래 `@theme` 선언 토큰만 사용**한다 *(예외: 1px/0.5px hairline border 및 blur 반경)*.  
> **상위 라우터:** [DESIGN.md](./DESIGN.md) | **백오피스 UX 스킬:** [corenuri-ui-standards/SKILL.md](../../.agents/skills/corenuri-ui-standards/SKILL.md)

---

## Colors & Exact Tailwind v4 `@theme` (`apps/web/src/styles/admin.css`)

```css
/* apps/web/src/styles/admin.css — Atlas Precision Studio (REM-Only) */
@theme {
  /* Fonts */
  --font-sans: "Inter", "Pretendard Variable", "Pretendard", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Atlas Extra Type & Radius Tokens (Tailwind 기본 스케일 보완용 사전 선언 rem) */
  --text-control: 0.8125rem;        /* 13px — 버튼·셀렉트·메뉴·사이드바·다이얼로그 본문 */
  --text-floating-title: 0.9375rem; /* 15px — 다이얼로그·토스트 타이틀 */

  --radius-checkbox: 0.4375rem;     /* 7px — checkbox */
  --radius-badge: 0.5rem;           /* 8px — badge, kbd (= rounded-lg) */
  --radius-btn-sm: 0.625rem;        /* 10px — button sm, menu hover pill */
  --radius-control: 0.75rem;        /* 12px — button md, input, select, card, tooltip (= rounded-xl) */
  --radius-menu: 0.875rem;          /* 14px — button lg, menu popup */
  --radius-panel: 1rem;             /* 16px — table, dialog, drawer, popover, toast (= rounded-2xl) */
  --radius-auth: 1.25rem;           /* 20px — admin auth card */

  /* Warm-Neutral OKLCH Gray Scale (Hue 70, ultra-low chroma) */
  --color-black: oklch(0% 0 0);
  --color-white: oklch(100% 0 0);
  --color-gray-50: oklch(99.2% 0 70);
  --color-gray-100: oklch(97% 0.001 70);
  --color-gray-200: oklch(91% 0.002 70);
  --color-gray-300: oklch(84.5% 0.003 70);
  --color-gray-400: oklch(71% 0.004 70);
  --color-gray-500: oklch(57.5% 0.005 70);
  --color-gray-600: oklch(46% 0.004 70);
  --color-gray-700: oklch(37% 0.004 70);
  --color-gray-800: oklch(28% 0.002 70);
  --color-gray-900: oklch(21.5% 0.002 70);
  --color-gray-950: oklch(16% 0.001 70);

  /* Status OKLCH Palette (Purple Ban 준수) */
  --color-blue-400: oklch(68% 0.16 255);
  --color-blue-600: oklch(53% 0.19 258);
  --color-green-400: oklch(72% 0.13 153);
  --color-green-600: oklch(54% 0.15 153);
  --color-green-700: oklch(46% 0.115 153);
  --color-amber-400: oklch(78% 0.16 80);
  --color-amber-600: oklch(54% 0.16 70);
  --color-coral-400: oklch(72% 0.17 29);
  --color-coral-600: oklch(54% 0.2 29);
  --color-coral-700: oklch(46% 0.165 29);
}

:root {
  color-scheme: light dark;

  /* 3-Tier Surface & Text (light-dark dual) */
  --bg-base-1: light-dark(var(--color-gray-50), var(--color-gray-950));
  --bg-base-2: light-dark(var(--color-gray-100), var(--color-gray-900));
  --bg-base-3: light-dark(var(--color-white), var(--color-gray-900));
  --bg-overlay: light-dark(#00000026, #00000080);
  --bg-inverse: light-dark(var(--color-gray-900), var(--color-gray-50));
  --text-neutral: light-dark(var(--color-gray-950), var(--color-gray-50));
  --text-secondary: light-dark(var(--color-gray-600), var(--color-gray-300));
  --text-subdued: light-dark(var(--color-gray-600), var(--color-gray-400));
  --text-on-inverse: light-dark(var(--color-white), var(--color-gray-900));

  /* Semantic Status & Focus Accent */
  --text-info: light-dark(var(--color-blue-600), var(--color-blue-400));
  --text-positive: light-dark(var(--color-green-600), var(--color-green-400));
  --text-warning: light-dark(var(--color-amber-600), var(--color-amber-400));
  --text-negative: light-dark(var(--color-coral-600), var(--color-coral-400));
  --text-accent: light-dark(var(--color-blue-600), var(--color-blue-400));
  --bg-accent: light-dark(var(--color-blue-600), var(--color-blue-400));

  /* Hairline, Rings & Frosted Glass */
  --ui-hairline-width: 1px;
  --ui-corner-shape: superellipse(1.3);
  --border-neutral: color-mix(in oklab, var(--text-neutral) 13%, transparent);
  --ring-float: color-mix(in oklab, var(--bg-base-3), var(--text-neutral) 13%);
  --glass-pigment: light-dark(var(--color-white), var(--color-gray-800));
  --glass-contrast: light-dark(var(--color-gray-900), var(--color-white));
  --glass-bg: color-mix(in oklab, var(--glass-pigment) 72%, transparent);
  --glass-ring: color-mix(in oklab, var(--glass-pigment), var(--glass-contrast) 13%);

  /* Shell & Motion */
  --ui-sidebar-width: 15rem;      /* w-60 */
  --ui-sidebar-collapsed: 3rem;   /* w-12 */
  --ease-hover-in: cubic-bezier(0.33, 1, 0.68, 1);
  --ease-hover-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-panel: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-dialog: cubic-bezier(0.4, 0, 0.6, 1);
  --dur-hover-in: 150ms; --dur-hover-out: 100ms; --dur-control: 125ms;
  --dur-panel: 200ms; --dur-dialog-in: 200ms; --dur-dialog-out: 150ms;
  --dur-drawer: 300ms; --dur-tooltip-in: 80ms; --dur-tooltip-out: 140ms;
}

@media (resolution >= 2x) {
  :root {
    --ui-hairline-width: 0.5px;
  }
}
```

---

## Typography (Tailwind v4 `rem` 클래스 매핑)
- **Body 기본**: `bg-base-1 text-sm antialiased` (`0.875rem`).
- **타입 스케일**: `text-xs`(`0.75rem`) · **`text-control`(`0.8125rem`)** · `text-sm`(`0.875rem`) · **`text-floating-title`(`0.9375rem`)** · `text-base`(`1rem`) · `text-lg`(`1.125rem`) · `text-xl`(`1.25rem`) · `text-2xl`(`1.5rem`) · `text-3xl`(`1.875rem`) · `text-4xl`(`2.25rem`).
- **Weights**: `font-normal`(400, 본문/인풋/툴팁) · `font-[450]`(또는 `font-medium`, 버튼/배지/kbd/셀렉트/아코디언) · `font-medium`(500, 라벨/테이블 헤더/사이드바 헤더/토스트 타이틀) · `font-semibold`(600~650, 사이드바 그룹·다이얼로그/드로어 타이틀) · `font-bold`(700).
- **Leading / Tracking**: `leading-tight`(1.25) · `leading-snug`(1.375) · `leading-normal`(1.5) · `leading-relaxed`(1.625) / `tracking-tight`(-0.025em) · `tracking-wide`(+0.025em).
- **`tabular-nums` 필수**: 금액·포인트·수량·날짜·`kbd`·`number-field` 전 수치에 적용 (테이블 수치 컬럼 우측 정렬).

---

## Layout & Spacing (Tailwind v4 `rem` 유틸리티)
- **Container Width**: `max-w-xs`(`20rem`) · `max-w-sm`(`24rem`) · `max-w-md`(`28rem`) · `max-w-xl`(`36rem`) · `max-w-2xl`(`42rem`) · `max-w-3xl`(`48rem`) · `max-w-5xl`(`64rem`) · `max-w-6xl`(`72rem`).
- **Topbar**: `h-12`(`3rem`, 스케일 `h-10`~`h-16`), `px-4`, `gap-3`, 하단 hairline.
- **Sidebar (`w-60` `15rem` 확장 / `w-12` `3rem` 축소)**:
  - Surface & Divider: `bg-base-1`, 우측 hairline(`var(--border-neutral)`).
  - Header: `py-4 px-3.5 gap-2.5`, 아이콘 `size-5`, 라벨 `font-medium`.
  - Group: `p-2` · Group Label: `h-5 py-0.5 px-2 text-xs leading-4 font-semibold text-secondary` (접힘 시 중앙 `w-5` 수평 hairline).
  - Menu Item: `px-2 gap-2.5 text-control leading-4`, 아이콘 `size-4.5`, hover `4%` / active `7% currentColor`. 접힘 시 `w-8 mx-auto`.
  - Submenu: `py-0.5 ms-4 ps-3`, 좌측 hairline 가이드선(`inset-y-1`).
  - Footer: `p-2 gap-2`.
- **Main Content**: `p-4`~`p-6`, 섹션 `gap-4`, 폼 필드 `gap-1.5`.

---

## Elevation, Focus Ring & Z-Index
- **Floating Shadow**: `shadow-lg` (`0 10px 15px -3px / 0 4px 6px -4px`) + hairline ring(`13%`).
- **Tooltip / Active Segmented**: `shadow-xs` (`0 1px 3px 0 / 0 1px 2px -1px`) + hairline ring.
- **Frosted Thick Glass**: `backdrop-blur-lg` (`16px`) + `bg-[var(--glass-bg)]` (`72%`) + `ring-[var(--glass-ring)]` (`13%`).
- **Focus Ring**: `focus-visible:outline-2 focus-visible:outline-offset-2` (`text-field`는 `outline-3` `25%` halo, `outline-offset-0`).
- **Z-Index**: `z-10`(본문) · `z-20`(헤더/스티키) · `z-30`(사이드바) · `z-40`(드로어 스와이프) · `z-50`(Dialog/Drawer/Popover/Toast Viewport) · 스택 토스트 `calc(1000 - index)`.

---

## Components (Tailwind v4 `rem` 클래스 명세표)

| 컴포넌트 | 높이 / 폭 (Tailwind `rem`) | 패딩 · 마진 · Gap (`rem`) | 타이포 · 라운드 · 상태 |
| :--- | :--- | :--- | :--- |
| **Button `sm`** | `h-6` (`1.5rem`) | `px-2`, icon `size-4` | `text-xs leading-none`, `rounded-btn-sm` (`0.625rem`) |
| **Button `md` (기본)** | `h-7` (`1.75rem`) | `px-2.5 gap-1.5`, icon `size-4` | `text-control leading-none`, `rounded-control` (`0.75rem`), `solid`(`inverse`) hover `+9%`/active `+14%`, `tint`(10%/13%), `outline`(13%), `ghost`(6%/8%), `disabled:opacity-45` |
| **Button `lg`** | `h-8` (`2rem`) | `px-3.5`, icon `size-4.5` | `text-sm leading-none`, `rounded-menu` (`0.875rem`) |
| **Input / TextField** | `h-7` (`1.75rem`) | `px-2.5` (prefix `w-7 ps-1 pe-2`) | `text-sm leading-none font-normal`, `rounded-control`, `bg-base-1`, inset hairline, focus `25%` halo |
| **Textarea** | `min-h-20` (`5rem`) | `py-2 px-2.5` | `text-sm leading-5`, `rounded-control`, `resize-y` |
| **Select Trigger** | `h-7 min-w-40` | `ps-3 pe-2 gap-1.5` | `text-control leading-none`, `rounded-control`, inset hairline, hover `4%` / active `7%` |
| **Field / NumberField** | step btn `w-7` | `gap-1.5` | Label `text-sm font-medium` / Desc·Error `text-xs leading-4` / `tabular-nums` |
| **Badge / Kbd** | `h-5` (kbd `min-w-5`) | `px-1.5 gap-1`, icon `size-3.5` | `text-xs leading-none`, `rounded-badge` (`0.5rem`), Badge `10%` / Kbd `15%` |
| **Choice Card** | - | `p-2.5 gap-2` (내부 `gap-0.5`) | `rounded-control`, hairline border, title `text-sm font-medium`, desc `text-sm text-secondary`, active `bg-base-2` |
| **Data Table** | head `h-9` (`2.25rem`) | cell `py-2.5 px-3` (첫/끝 외측 `ps-4`/`pe-4`) | container `rounded-panel` (`1rem`) + hairline, head `bg-base-2 text-xs font-medium`, body `text-sm`, hover `3%` / selected `6%` |
| **Drawer / Sheet** | `w-80`~`w-120` (`max-w-[85vw]`) | floating `m-2`, content `p-4`, desc `mt-1.5` | `rounded-panel`, `bg-base-3`, title `text-base font-semibold`, desc `text-sm`, grip `w-9 h-1`, `duration-300` |
| **Dialog / Modal** | `max-w-sm`~`max-w-md` | viewport `p-4`, popup `p-4`, desc `mt-1.5` | `rounded-panel`, `bg-base-3`, title `text-floating-title font-semibold`, desc `text-control`, `200ms`/`150ms` |
| **Menu Popup** | item `min-h-7` | popup `py-1`, item `ps-2.5 pe-3.5 gap-2` | `rounded-menu` (`0.875rem`), `text-control`, `backdrop-blur-lg`, item hover `inset-x-1 rounded-btn-sm`, shortcut `ps-6` |
| **Popover / Tooltip** | `max-w-80` (`20rem`) | Popover `p-4` (`mt-1.5`) / Tooltip `py-1.5 px-2.5` | Popover `rounded-panel text-control` / Tooltip `rounded-control text-xs leading-4`, `backdrop-blur-lg` |
| **Toast** | `max-w-90` (`22.5rem`) | offset `p-4`/`p-8`, content `p-3.5 gap-3` | `rounded-panel`, title `text-floating-title font-medium`, desc `text-control mt-1.5`, `backdrop-blur-lg` |
| **Segmented Control** | item `h-6` (`1.5rem`) | group `p-0.5 gap-0.5`, item `px-2.5` | `rounded-control`, group `5%` bg, `text-control`, active `bg-base-3`/8% + `shadow-xs` + hairline |
| **Switch / Check / Radio** | Switch `w-7 h-4` / Check·Radio `size-4` | group `gap-2` | Switch thumb `size-3 rounded-full` / Checkbox `rounded-checkbox` icon `size-2.5` / Radio dot `size-2` |
| **Accordion / Scrollbar** | Scrollbar `w-2.5` (`0.625rem`) | Accordion trigger `py-2.5 gap-2` / Scroll `p-0.5` | Accordion `text-sm` + hairline / Scroll thumb `32%` (hover `44%`) `rounded-full` |

---

## Do's and Don'ts
- **Do**: 모든 치수는 선언된 `rem` 토큰과 Tailwind v4 기본 유틸리티(`h-7`, `px-2.5`, `text-control`, `rounded-panel` 등)만 사용, 수치 컬럼 `tabular-nums` 우측 정렬, `lucide-react` 단색 SVG(`size-4 stroke-[1.75]`) 전용.
- **Don't**: 컴포넌트 내 임의 `px` arbitrary(`text-[13px]`, `h-[28px]`) 금지, 사용자 앱(`DESIGN_WEB.md`) 팝 파스텔/모바일 버튼 혼입 금지, 유니코드 이모지 금지, 보라색 기본 spot 금지.
