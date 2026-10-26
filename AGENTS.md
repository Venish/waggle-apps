<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

🏗️ Corenuri Standard Framework: Waggle Monorepo (Turborepo & pnpm Workspaces)
<!-- [Pending] Firebase / Real DB Architecture -->

본 지침은 와글(Waggle — 반려견 라이프로그·산책·교육·미션/리워드·포인트샵 통합 서비스) 웹/앱 서비스를 위한 단일 진실 공급원(SSOT)입니다.
Turborepo와 pnpm workspaces 기반의 모노레포 구조로 사용자 서비스(`apps/web`)와 관리자 콘솔(`apps/admin`)을 분리하고, DB 및 비즈니스 레이어(`packages/*`)를 공유하는 AI-Native 프레임워크 표준을 정의합니다.
현재 인증 및 데이터 연동은 **Mock 데이터/Mock Auth (DAL 패턴)** 기준으로 동작하며, 추후 실서버 DB 전환 시에도 상위 코드 수정 없이 DAL 내부만 교체합니다.

---

1. 필수 참조 스킬셋 및 아키텍처 가이드 (Mandatory Skills & Docs)

모든 코드 생성 시 아래 규칙을 반드시 준수하십시오.
- **영구 보존 커스텀 스킬 (`.agents/skills/`)**: `antigravity-kit` 재설치와 무관하게 영구 보존되는 프로젝트 핵심 스킬셋입니다.
- **순정 Kit 스킬 (`.agent/skills/`)**: `antigravity-kit` 기본 제공 스킬셋입니다.

### 1.1 코어 아키텍처 스킬 (`.agents/skills/` — 코아누리 커스텀 보존 7종)
- **Monorepo (Operator)**: `.agents/skills/turborepo-pnpm-workspace/SKILL.md` (Turborepo v2 `tasks`, 물리 구조, 거버넌스)
- **Action (Gateway)**: `.agents/skills/nextjs-server-actions/SKILL.md` (`03_actions` Zod 검증 및 `ActionResult<T>` 반환)
- **Service (Isolation)**: `.agents/skills/server-only-services/SKILL.md` (`04_services` `server-only` 격리 및 Public/Private IDOR 방어)
- **Next.js (Expert)**: `.agents/skills/nextjs-expert/SKILL.md` (Next.js 16 App Router 및 `proxy.ts` 3-Tier 가드)
- **State (Client)**: `.agents/skills/zustand-state-management/SKILL.md` (`01_store` Zustand `isLoaded` 캐시, `useAlert`, `useModalStore`)
- **Design (Styling)**: `.agents/skills/tailwind-v4-standard/SKILL.md` (Tailwind v4 `@theme` 및 무경계/정적 클래스 표준)
- **UI (Components)**: `.agents/skills/shadcn/SKILL.md` (shadcn/ui 기반 `@repo/ui` 컴포넌트 확장)

### 1.2 UI 엔지니어링 & 최신 AG-Kit 핵심 스킬 (`.agents/skills/`)
- **UI Polish (커스텀 보존)**: `.agents/skills/make-interfaces-feel-better/SKILL.md` (동심원 곡률, `tabular-nums`, `scale(0.96)`, 스프링 트랜지션)
- **Color OKLCH (커스텀 보존)**: `.agents/skills/oklch-skill/SKILL.md` (Tailwind v4 OKLCH 컬러 토큰 및 다크모드 명도 대비)
- **Frontend Design (AG-Kit 내장)**: `.agents/skills/frontend-design/SKILL.md` (Anti-Slop 디자인, `style-minimalist.md`, `redesign.md` 통합본)
- **Next/React Perf (AG-Kit 내장)**: `.agents/skills/nextjs-react-expert/SKILL.md` (Vercel 공식 58개 성능 최적화 규칙)
- **Simplify Code (AG-Kit 내장)**: `.agents/skills/simplify-code/SKILL.md` (오버엔지니어링 제거 및 KISS 원칙 강제)

### 1.3 필수 참조 아키텍처 문서 (`.docs/`)
- **Sheet & Swipe Layout (공통 쉘 & 모달 좌우/상하 스와이프 표준)**: [`.docs/architecture/APP_SHEET_FRAME_GUIDE.md`](file:///.docs/architecture/APP_SHEET_FRAME_GUIDE.md) (`AppSheetFrame` 3단 쉘, 430px 모바일 프레임, `GlobalOverlayProvider` 좌우/상하 스프링 스와이프, `useModalHistory` iOS 엣지 스와이프/안드로이드 뒤로가기 방어, 닫힘 시 리소스 킬 의무화)
- **Data & Zustand Sync**: [`.docs/architecture/DATA_LOADING_AND_ZUSTAND_SYNC.md`](file:///.docs/architecture/DATA_LOADING_AND_ZUSTAND_SYNC.md) (RSC 1회 페칭 + Zustand `isLoaded` 캐시 & 0ms 낙관적 업데이트)
- **Design System**: [`.docs/architecture/DESIGN.md`](file:///.docs/architecture/DESIGN.md) & [`.docs/specs/design-theme-guide.md`](file:///.docs/specs/design-theme-guide.md)
- **Waggle 도메인 기획/명세**: `.docs/specs/` 하위 요구사항 정의서 및 화면설계서 참조

---

2. 모노레포 앱 및 패키지 구성 (App & Package Structure)

| 구분 | 워크스페이스 명칭 | 포트 / 역할 | 의존성 및 패키지 참조 |
|---|---|---|---|
| `apps/web` | `@repo/web` | `:3000` (사용자 모바일 웹앱 & 랜딩) | `@repo/db`, `@repo/types`, `@repo/ui` |
| `apps/admin` | `@repo/admin` | `:3001` (관리자 콘솔) | `@repo/db`, `@repo/types`, `@repo/ui` |
| `packages/db` | `@repo/db` | Drizzle Schema / DAL & Mock JSON | Drizzle ORM, Drizzle Kit |
| `packages/types` | `@repo/types` | 전역 공통 도메인/Action 타입 | Zod, TypeScript Shared Types |
| `packages/ui` | `@repo/ui` | 공통 UI 컴포넌트 / 테마 | Tailwind v4, shadcn/ui |

---

3. 모노레포 디렉터리 구조 (Monorepo Anatomy)

```
<repo-root>/
├── apps/
│   ├── web/                        # 사용자 서비스 (:3000)
│   │   ├── src/
│   │   │   ├── 00_lib/             # App 전용 클라이언트 초기화 (session.ts, mock-auth.ts 등)
│   │   │   ├── 01_store/           # 전역 상태 관리 (Zustand, useAlert.ts, useModalStore.ts)
│   │   │   ├── 02_hooks/           # 커스텀 훅 (비즈니스 로직 SSOT, useModalHistory.ts)
│   │   │   ├── 03_actions/         # Server Actions (Zod 검증, ActionResult 반환)
│   │   │   ├── 04_services/        # server-only 비즈니스 서비스 (*MasterService / my*Service)
│   │   │   ├── 05_types/           # Web 전용 인터페이스
│   │   │   ├── components/         # Web 전용 UI 컴포넌트 (AppSheetFrame, GlobalOverlayProvider 등)
│   │   │   ├── app/                # Next.js App Router
│   │   │   │   ├── api/auth/session-expired/route.ts # 무한 리다이렉트 방지 세션 정리
│   │   │   │   └── ...
│   │   │   └── proxy.ts            # Next 16 미들웨어 (middleware.ts 대신 proxy.ts)
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── admin/                      # 관리자 콘솔 (:3001)
│       ├── src/                    # (web과 동일한 6단계 레이어 아키텍처 + proxy.ts)
│       ├── next.config.ts
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── db/                         # @repo/db (Drizzle ORM 스키마 & DAL 계층)
│   │   ├── src/
│   │   │   ├── data/               # DAL (mock/*.json + repos/*Repo.ts)
│   │   │   ├── schema/             # Drizzle 테이블 스키마 정의 (Type 추출 및 실서버 공용)
│   │   │   ├── client.ts           # 실서버 Drizzle DB Client (실제 DB 연결용 원형 보존)
│   │   │   └── index.ts
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── types/                      # @repo/types (공통 ActionResult, 에러, 도메인 타입)
│   │   ├── src/
│   │   │   ├── action.ts           # ActionResult<T> 공통 규격
│   │   │   ├── error.ts            # AppError 클래스
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── ui/                         # @repo/ui (공통 테마 토큰 & 공용 컴포넌트)
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
│
├── .agent/                         # 순정 antigravity-kit (언제든 재설치 가능)
├── .agents/skills/                 # 코아누리/와글 영구 보존 커스텀 스킬 12종
├── .docs/                          # 아키텍처 표준(architecture/) 및 기획 명세(specs/)
├── pnpm-workspace.yaml             # pnpm 워크스페이스 선언
├── turbo.json                      # Turborepo 파이프라인 & Strict Env 규칙
├── package.json                    # 루트 통합 스크립트
└── tsconfig.json                   # 루트 기본 TSConfig
```

---

4. 모노레포 거버넌스 및 규칙 (Governance & Cross-Import Policy)

- **Naming Rule**: 모든 내부 공유 패키지는 반드시 **`@repo/*`** 네임스페이스를 사용합니다.
- **Internal Reference Protocol**: 패키지 간 참조는 반드시 **`workspace:*`** 프로토콜을 사용합니다.
  ```json
  "dependencies": {
    "@repo/db": "workspace:*",
    "@repo/types": "workspace:*"
  }
  ```
- **Cross-Import 금지**: `apps/web` ↔ `apps/admin` 간의 직접 import는 원천 금지합니다. 공통 모듈은 반드시 `packages/*`로 추출하여 공유합니다.
- **Circular Dependency 금지**: 패키지 간의 순환 참조(`A -> B -> A`)는 빌드 타임에서 원천 차단합니다.
- **Strict Typing**: `any` 사용을 절대 금지하며, `pnpm exec tsc --noEmit`을 통해 모든 패키지의 타입 안정성을 보장합니다.

---

5. 핵심 아키텍처: 6단계 레이어 (Core Layers - App Level)

관심사 분리와 AI 컨텍스트 최적화를 위해 각 App(`apps/web`, `apps/admin`) 내 `src/` 하위 구조를 다음과 같이 엄격히 준수합니다.

1. **`00_lib/`**: SDK 및 라이브러리 초기화 (Mock Client, 세션 가드 등)
2. **`01_store/`**: 클라이언트 전역 상태 관리 (Zustand, 전역 `useAlert`, `useModalStore`)
3. **`02_hooks/`**: 재사용 가능한 비즈니스 로직 및 상태 연동 (Custom Hooks, `useModalHistory`)
4. **`03_actions/`**: 서버 진입점 (Zod 유효성 검사, 에러 핸들링, `ActionResult` 반환)
5. **`04_services/`**: 순수 비즈니스 로직 (**server-only**, Mock/DB Service)
6. **`05_types/`**: App 전용 타입 및 인터페이스 정의

5.1 `04_services` 이원화 및 JWT/세션 보안 가드 표준 (Public Master vs Private My)
비즈니스 서비스 계층은 보안(IDOR 취약점 차단) 및 캐싱 전략의 분리를 위해 다음과 같이 2개 축으로 엄격히 이원화합니다.

1. **공용/마스터 서비스 (`*MasterService.ts` / Public)**:
   - 모든 사용자에게 동일한 불변/공통 데이터 (교육 콘텐츠 목록, 미션 카탈로그, 포인트샵 상품 목록, 약관 등).
   - 인증 없이도 접근 가능하며 CDN/서버 메모리 캐싱(`revalidate`) 적극 활용.
2. **개인화 서비스 (`my*Service.ts` / Private & Strict Auth)**:
   - 특정 유저 본인의 데이터 (내 반려견 프로필, 산책 기록, 미션 달성 내역, 포인트 원장, 주문 내역 등).
   - **IDOR 방어 강제**: 외부 파라미터로 `userId`를 받지 않고, 내부에서 **JWT/세션 토큰을 검증(`getAuthenticatedUser`)**하여 추출된 본인 `userId`로만 DB 작업을 수행.
   - 캐시 절대 금지 (`no-store` / 즉시 DB 동기화).

---

5.2 App Router 라우팅 패턴 가이드 (프로젝트 목적별 선택)

- **타입 A. 단일 웹 전용 패턴 (Flat Web Pattern)**
  - `src/app/` 바로 아래에 `layout.tsx`와 `page.tsx`, `sub-page/page.tsx`를 플랫하게 배치.
- **타입 B. 웹+앱 이원화 패턴 (Subpath Separation Pattern — 마케팅 + 보호 서비스 웹앱)**
  - 공개 마케팅 영역은 `(marketing)` Route Group으로, 실제 보호 서비스 웹앱은 `/app` 하위 서브패스로 명확히 격리.
  ```
  src/app/
  ├── layout.tsx              # Root Layout (<html>, <body>, 폰트, 전역 Alert 등 최소화)
  ├── (marketing)/            # 🌐 공개 웹 영역 (마케팅 GNB + 랜딩 푸터 + SEO)
  │   ├── layout.tsx
  │   └── page.tsx            # 👉 https://domain.com/ (랜딩 메인)
  ├── login/page.tsx          # 🔑 로그인 페이지 (👉 https://domain.com/login)
  └── app/                    # 📱 서비스 웹앱 영역 (430px 프레임 + GlobalOverlayProvider + 세션 가드)
      ├── layout.tsx          # 2차 세션 가드 & 앱 쉘 레이아웃
      └── page.tsx            # 👉 https://domain.com/app (앱 서비스 메인)
  ```

---

6. 에러 핸들링 및 응답 표준 (Error Handling)

- **AppError Class**: 전역 에러 클래스를 정의하여 HTTP 상태 코드와 사용자 메시지를 구조화 (`@repo/types`).
- **ActionResult**: 모든 Server Action은 아래의 공통 인터페이스를 반환합니다.
  ```typescript
  export type ActionResult<T = void> = 
    | { success: true; data: T }
    | { success: false; error: string; code?: string };
  ```
- **Zod 기반 검증**: 입구(Action)에서 `z.safeParse()`를 사용하여 데이터 유효성을 검증합니다.
- **Gateway Handling**: `03_actions`에서 모든 에러를 포착하여 `ActionResult` 포맷으로 변환합니다.

---

7. 인증, 세션 & 쿠키 표준 (Mock Auth & Next 16 Proxy)

7.1 Web / Admin 세션 쿠키 분리
- 브라우저 쿠키는 포트(`:3000`, `:3001`)를 구분하지 않으므로 쿠키 이름을 엄격히 분리합니다.
  - `apps/web`: `WAGGLE_APP_SESSION`
  - `apps/admin`: `WAGGLE_ADMIN_SESSION`

7.2 Next.js 16 `proxy.ts` 표준
- Next.js 16부터 `middleware.ts` 대신 **`proxy.ts`** 파일과 **`export function proxy(req: NextRequest)`** 함수를 사용합니다.
- **쿠키 존재 여부만 검증**: `proxy.ts`는 무거운 데이터 조회를 수행하지 않고 오직 **세션 쿠키 존재 여부**만 확인하여 리다이렉트합니다.

7.3 다단계 가드 (3-Tier Guard Pattern)
1. **`proxy.ts`**: 쿠키 존재 여부만 확인 (로그인 사용자가 `/login` 접근 시 서비스 페이지로 리다이렉트)
2. **`layout.tsx` & `page.tsx`**: React `cache()` 기반 세션 검증 (헤더 조작 및 직접 URL 접근 차단)
3. **`03_actions/*`**: 모든 Server Action 진입부에서 독립적으로 세션 및 권한 재검증

7.4 무한 리다이렉트 방지 (`/api/auth/session-expired` Route Handler)
- 쿠키는 남아있으나 세션이 만료/무효화된 경우, `proxy`와 페이지 가드가 서로를 무한 호출하는 루프 에러를 방지하기 위해 전용 정리 라우트를 경유합니다.

---

8. 데이터 레이어 표준 (Drizzle ORM Schema & Mock Data) & Next.js DAL 패턴

- **실서버 Drizzle Client (`client.ts`) 보존**: `packages/db/src/client.ts`는 실제 DB 연결 클라이언트로 원형을 유지하며 Mock 데이터로 덮어쓰지 않습니다.
- **Type-safe 스키마 SSOT**: `packages/db/src/schema/*.ts`에서 테이블 스키마를 정의하고 `typeof table.$inferSelect`를 통해 Mock 데이터셋 및 실서버의 타입을 통일합니다.

8.1 Next.js 공식 DAL (Data Access Layer) & Repository 패턴 규격 (★필수 수칙★)
- **물리 디렉터리 분리 표준 (`packages/db/src/data/`)**:
  ```
  packages/db/src/data/
  ├── mock/                       # 📂 순수 Mock JSON 데이터 전용 (데이터 작업자 영역)
  │   ├── users.json
  │   ├── dogs.json
  │   ├── walks.json
  │   ├── missions.json
  │   ├── points.json
  │   └── shop_items.json
  │
  ├── repos/                      # 📂 순수 TS Repository 함수 전용 (개발자 DAL 영역)
  │   ├── userRepo.ts
  │   ├── dogRepo.ts
  │   ├── walkRepo.ts
  │   ├── missionRepo.ts
  │   ├── pointRepo.ts
  │   ├── shopRepo.ts
  │   └── index.ts
  │
  └── index.ts                    # 단일 진입점 re-export hub (export * from "./repos")
  ```
- **DAL(Data Access Layer) 격리 원칙**:
  - 모든 데이터 입출력(CRUD, In-Memory/JSON find/upsert, Drizzle ORM SQL)은 반드시 `packages/db/src/data/repos/*Repo.ts`에 모듈화하여 배치합니다.
  - UI 컴포넌트나 비즈니스 서비스(`04_services`)에서 JSON 파일을 직접 파싱하거나 저수준 메모리 변이를 수행하는 것을 엄격히 금지합니다.
- **단방향 의존성 흐름 & Zero-Code-Change 실서버 전환**:
  - `03_actions` ➡️ `04_services` (비즈니스 규칙/IDOR 검증) ➡️ `packages/db/data` (순수 DAL) & `00_lib/session` 단방향 호출 흐름을 준수합니다.

---

9. UI, 모달 스와이프 및 폼 검증 표준 (Tailwind v4, AppSheetFrame & Global Alert)

9.1 공통 Alert & 입력 폼 검증 표준
- **Hydration 불일치 차단 (`suppressHydrationWarning`)**: 모든 Root Layout의 `<html lang="ko" suppressHydrationWarning>` 속성 지정을 강제합니다.
- **Zustand 전역 Alert 사용 의무**: 브라우저 기본 `window.alert()`를 금지하고 `useAlert` 훅을 통한 단일 인스턴스 전역 팝업을 사용합니다.
- **HTML5 검증 차단 (`noValidate`)**: 모든 폼에 `<form noValidate>` 속성을 주입하여 커스텀 얼럿과 충돌하지 않도록 합니다.
- **비동기 포커스 제어 (`useRef` + `setTimeout`)**: 입력값 누락 시 `setTimeout(() => ref.current?.focus(), 50)`으로 포커싱합니다.
- **배경 클릭 닫힘 방지 (`closeOnOverlayClick={false}`)**: 공통 `<Alert />`의 배경 클릭 닫힘을 차단하여 후속 콜백 유실을 방지합니다.

9.2 430px 모바일 프레임 & `AppSheetFrame` 좌우/상하 모달 스와이프 표준 (★필수★)
- 상세 구현 명세는 [`.docs/architecture/APP_SHEET_FRAME_GUIDE.md`](file:///.docs/architecture/APP_SHEET_FRAME_GUIDE.md)를 따릅니다.
- **App-Like Global Overlay (`GlobalOverlayProvider`)**: 서브 페이지, 상세 화면, 설정, 체크인 등 모달/시트 뷰는 라우트 전체를 언마운트하지 않고 대시보드가 100% 유지되는 Framer Motion 전역 오버레이(`useModalStore`)를 사용합니다 (`x: "100%" -> 0` 좌우 슬라이드 또는 `y: "100%" -> 0` 바텀시트).
- **`AppSheetFrame` 3단 쉘**: 모든 시트와 서브 화면은 `header` (`subHeader` 포함) + `children` (본문 스크롤) + `bottom` (하단 고정 CTA, `pb-safe-bottom` 단일 제어)의 3단 쉘 구조를 사용하며, 자식 컴포넌트 내부에 임의로 `fixed bottom-0`이나 `pt-safe`/`pb-safe`를 중복 작성하지 않습니다.
- **3중 모바일 네비게이션 가드 (`useModalHistory`)**:
  1) CSS `overscroll-behavior-x: none; touch-action: pan-y;`로 iOS 좌우 엣지 스와이프 브라우저 뒤로가기 차단
  2) 모달 오픈 시 `history.pushState` + `popstate` 인터셉트로 안드로이드 물리 뒤로가기 클릭 시 라우트 이탈 없이 모달만 안전하게 닫힘 처리
  3) 모달 닫힘 시 내부 타이머(`setInterval`, `setTimeout`), 애니메이션, GPS/오디오 등 모든 백그라운드 리소스 즉시 클린업

9.3 Core UI 엔지니어링 가드레일
- **Static Tailwind Classes Only**: `grid-cols-${n}` 같은 동적 클래스 문자열 조합 금지.
- **Concentric Border Radius**: `innerRadius = outerRadius - padding` 동심원 곡률 유지.
- **Tabular Numbers**: 동적 수치/포인트/타이머에 `tabular-nums` 필수 적용.
- **Micro-Interactions**: 클릭/터치 요소에 `active:scale-[0.96] transition-transform` 및 최소 터치 타겟 `44px` 보장.
- **Non-White Container Borderless Principle**: 배경색이 순수 흰색(`bg-white`)이 아닌 컨테이너(`bg-gray-50`, 파스텔 틴트 박스 등)에는 테두리(`border`)를 적용하지 않고 무경계(Borderless)로 제작합니다. 테두리는 순수 `bg-white` 카드에만 미세 헤어라인으로 허용합니다.
- **Z-Index Scale**: `z-10` (메인 대시보드) ➔ `z-20` (상단 헤더) ➔ `z-30` (하단 탭바) ➔ `z-40` (1차 오버레이 시트) ➔ `z-45` (2차 중첩 시트) ➔ `z-60` (최상위 시스템 Alert/Popup).

---

10. 전역 스크립트 및 Turborepo 파이프라인 (Root Scripts & Turbo Strict Env)

```json
{
  "scripts": {
    "dev": "turbo dev",
    "dev:web": "turbo dev --filter=@repo/web",
    "dev:admin": "turbo dev --filter=@repo/admin",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "clean": "turbo clean"
  }
}
```
- 새 환경변수 추가 시 반드시 `turbo.json`의 `env` 배열에 등록합니다.

---

11. 개발 규칙 및 제약 사항

- **Package Manager Principle (★pnpm 전용 원칙★)**: 모든 의존성 관리 및 스크립트 실행은 반드시 **`pnpm`**만을 사용합니다 (`npm`, `yarn` 금지).
- **Python Utility**: 파이썬 스크립트 실행 및 관리는 반드시 **`uv`**(`uv run`, `uv add`)를 사용합니다.
- **Strict Typing & TS 검증 의무**: `any` 사용을 절대 금지하며, 코드 변경 완료 후 반드시 `pnpm typecheck`으로 컴파일 유효성을 검증합니다.
- **브라우저 실행 제약**: 브라우저 실행 도구는 사용자의 명시적인 지시가 있을 때만 실행합니다.
- **문서 갱신 SSOT**:
  - [`.docs/architecture/HISTORY.md`](file:///.docs/architecture/HISTORY.md): `[YYYY-MM-DD HH:mm] 태스크명 (상태)` 기록 유지.
  - [`.docs/architecture/CODEBASE.md`](file:///.docs/architecture/CODEBASE.md): 핵심 Action, Service, Repo 시그니처 최신 유지.
  - [`.docs/architecture/FLOWS.md`](file:///.docs/architecture/FLOWS.md): 주요 비즈니스 로직 및 데이터 흐름 기록.
