<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

🏗️ Corenuri Standard Framework: Waggle Monorepo
<!-- Turborepo v2 & pnpm Workspaces | Next.js 16.2.6 + Tailwind v4 + PostgreSQL 18 Drizzle DAL -->

본 지침은 와글(Waggle — 반려견 교육·데일리 기록·포인트/결제·포인트샵 통합 서비스) 웹/앱 및 운영 백오피스의 단일 진실 공급원(SSOT)입니다.
초기 단일 서버 운영 효율과 추후 확장을 모두 잡기 위해, **Turborepo + pnpm workspaces 모노레포 위에 단일 Next.js 앱(`apps/web`: 3 Route Group — `(www)` 소개 · `(mobile)` `/app/*` · `(admin)` `/admin/*`)**과 3개 공용 패키지(`@repo/db`, `@repo/types`, `@repo/ui`)를 구성합니다. 각 영역은 **독립 Root Layout · 전용 CSS(`styles/web.css` vs `styles/admin.css`) · `web/` vs `admin/` 폴더 경계**로 100% 물리 격리하여, 추후 서버 증설 시 `apps/admin`으로 무중단 분리할 수 있도록 설계합니다.

---

## 1. 필수 참조 스킬셋 및 `.docs/` 5대 문서 거버넌스 (Mandatory Skills & Docs)

### 1.1 코어 아키텍처 및 UI 스킬 (`.agents/skills/`)
- **Monorepo**: `.agents/skills/turborepo-pnpm-workspace/SKILL.md` (Turborepo v2 `tasks`, 패키지 거버넌스)
- **Next.js 16**: `.agents/skills/nextjs-expert/SKILL.md` (`proxy.ts` 3-Tier 세션 가드 및 만료 루프 방지)
- **Server Actions**: `.agents/skills/nextjs-server-actions/SKILL.md` (`03_actions` Zod 검증 및 `ActionResult<T>`)
- **Services**: `.agents/skills/server-only-services/SKILL.md` (`04_services` `server-only`, Public/Private 분리 및 IDOR 차단)
- **State**: `.agents/skills/zustand-state-management/SKILL.md` (`01_store` Zustand `isLoaded` 캐시, 낙관적 업데이트, `useAlert`, `useModalStore`)
- **User UI (`(www)` · `(mobile)`)**: `.agents/skills/make-interfaces-feel-better/SKILL.md`, `.agents/skills/oklch-skill/SKILL.md`, `.agents/skills/frontend-design/SKILL.md`
- **Admin Console UI (`(admin)`)**: `.agents/skills/corenuri-ui-standards/SKILL.md` (사이드바, 고밀도 데이터 테이블, 다중 필터, 우측 `Sheet` 드로어)
- **Styling & Primitives**: `.agents/skills/tailwind-v4-standard/SKILL.md`, `.agents/skills/shadcn/SKILL.md`
- **Coding, Perf & Typing**: `.agents/skills/coding-standard/SKILL.md`, `.agents/skills/typescript-pro/SKILL.md`, `.agents/skills/nextjs-react-expert/SKILL.md`, `.agents/skills/simplify-code/SKILL.md`

### 1.2 `.docs/` 5대 표준 디렉터리 (경량 SSOT 구성)
1. **`architecture/`** — 시스템 활성 표준만 유지 (일회성 기획안/플랜·`HISTORY.md` 생성 절대 금지)
   - [`.docs/architecture/DESIGN.md`](file:///.docs/architecture/DESIGN.md): 디자인 분리 게이트 허브 — 사용자(`(www)`·`(mobile)`) 전용 [`.docs/architecture/DESIGN_WEB.md`](file:///.docs/architecture/DESIGN_WEB.md) (Clean Neo-Pop · `styles/web.css`) · 관리자(`(admin)`) 전용 [`.docs/architecture/DESIGN_ADMIN.md`](file:///.docs/architecture/DESIGN_ADMIN.md) (Atlas Precision Studio · `styles/admin.css`) 100% 물리 분리 (루트에 중복 `DESIGN.md` 생성 금지)
   - [`.docs/architecture/APP_SHEET_FRAME_GUIDE.md`](file:///.docs/architecture/APP_SHEET_FRAME_GUIDE.md): `app/` 모바일 뷰포트 프레임, `AppSheetFrame` 3단 쉘, `GlobalOverlayProvider` 및 `useModalHistory` 3중 방어
   - [`.docs/architecture/DATA_LOADING_AND_ZUSTAND_SYNC.md`](file:///.docs/architecture/DATA_LOADING_AND_ZUSTAND_SYNC.md): RSC 1회 페칭 + Zustand `isLoaded` 캐시 & 낙관적 UI 규격
   - [`.docs/architecture/IMAGE_ASSET_GUIDE.md`](file:///.docs/architecture/IMAGE_ASSET_GUIDE.md): WebP 해상도/용량 기준 및 `<SafeImage />` 표준
   - [`.docs/architecture/CODEBASE.md`](file:///.docs/architecture/CODEBASE.md): 핵심 Action / Route Handler / Service / Repo 시그니처 맵
   - [`.docs/architecture/FLOWS.md`](file:///.docs/architecture/FLOWS.md): 인증·결제·배치 및 핵심 도메인 상태 전이 흐름
2. **`specs/`** — 와글 신규 도메인 명세([`.docs/specs/00_WAGGLE_마스터_설계서.md`](file:///.docs/specs/00_WAGGLE_마스터_설계서.md)) 및 인덱스([`.docs/specs/index.md`](file:///.docs/specs/index.md)). 구버전 기획서 24종은 **`.docs/specs/legacy/`**에 격리(참고 전용 — 직접 추종 금지).
3. **`data/`** — 기준정보 원본(견종/공통코드/커리큘럼/상품 샘플 CSV·XLSX) 및 물리 DB 테이블 정의서([`.docs/data/README.md`](file:///.docs/data/README.md)).
4. **`plan/`** — 설계서·구현 플랜(`YYYY-MM-DD_제목.md`) 및 마스터 인덱스([`.docs/plan/index.md`](file:///.docs/plan/index.md)). 필요 시 `plan/details/`(태스크보드·`GRILL_ME` 결정대장) 확장 가능.
5. **`history/`** — 일자별 변경 이력(`YYYY-MM-DD.md`) 및 마스터 인덱스([`.docs/history/index.md`](file:///.docs/history/index.md)).

---

## 2. 모노레포 앱 및 패키지 구성 (1-App + 3-Domain / 3-Package)

> 초기 단일 서버 배포를 위해 `apps/web` 단일 앱으로 통합하되, 3개 Route Group과 `web/`·`admin/` 내부 폴더를 철저히 격리하여 추후 서버 증설 시 `apps/admin`으로 즉시 분리 가능하게 유지합니다.

| 구분 | 워크스페이스 명칭 | 포트 / 역할 | 의존성 및 패키지 참조 |
| :--- | :--- | :--- | :--- |
| `apps/web` | `@repo/web` | `:3000` — **`(www)` 소개**(`www.*` / `/`) + **`(mobile)` 웹앱**(`app.*` / `/app/*`) + **`(admin)` 운영 콘솔**(`admin.*` / `/admin/*`, `proxy.ts` 3도메인 Host 리라이트 지원) | `@repo/db`, `@repo/types`, `@repo/ui` |
| `packages/db` | `@repo/db` | PostgreSQL 18 Drizzle Schema (`pg-core`) / DAL Repositories (`src/repos/*Repo.ts`) | `@repo/types`, Drizzle ORM, `pg`, Drizzle Kit, Zod |
| `packages/types` | `@repo/types` | 공통 응답(`ActionResult`, `AppError`) 및 `web`↔`admin` 교차 계약(세션·결제·원장·주문 상태 타입) | Zod, TypeScript Shared Types |
| `packages/ui` | `@repo/ui` | 테마 수치가 없는 공통 구조/접근성 UI 프리미티브 (`Sheet`, `Dialog`, `Table`, `Alert` 등) | Tailwind v4, shadcn/ui |

---

## 3. 모노레포 디렉터리 구조 (Monorepo Anatomy — 추후 `apps/admin` 분리 대비)

```text
<repo-root>/
├── apps/
│   └── web/                        # 단일 Next.js 16 앱 (:3000 — www + app + admin)
│       ├── src/
│       │   ├── styles/
│       │   │   ├── web.css         # 사용자 전용 Clean Neo-Pop 테마 ((www)/(mobile) 전용 import)
│       │   │   └── admin.css       # 관리자 전용 Atlas Precision Studio 테마 ((admin) 전용 import)
│       │   ├── 00_lib/             # DB 세션 검증(session.ts), userSessionConfig.ts, adminSessionConfig.ts
│       │   ├── 01_store/           # 클라이언트 전역 상태 (Zustand: web/ · admin/ 구분)
│       │   ├── 02_hooks/           # 커스텀 훅 (useModalHistory 등)
│       │   ├── 03_actions/         # Server Actions (web/ · admin/ 폴더 격리, Zod 검증 + ActionResult<T>)
│       │   ├── 04_services/        # server-only 비즈니스 서비스 (web/ · admin/ 폴더 격리)
│       │   ├── 05_types/           # 화면 전용 폼·필터·모달 인터페이스 (web/ · admin/ 폴더 격리)
│       │   ├── components/         # UI 컴포넌트 (web/ · admin/ 폴더 격리 — 상호 import 금지)
│       │   ├── app/                # Next.js 16 App Router (최상위 layout.tsx 없이 Route Group별 독립 <html>)
│       │   │   ├── (www)/          # 독립 layout.tsx (styles/web.css) — 공개 소개·마케팅 랜딩
│       │   │   ├── (mobile)/       # 독립 layout.tsx (styles/web.css) — /app/* 보호된 모바일 웹앱 + /login
│       │   │   ├── (admin)/        # 독립 layout.tsx (styles/admin.css) — /admin/* 운영 콘솔 + /admin/login
│       │   │   └── api/            # 예외 HTTP 진입점 (auth/session-expired, auth/callback/*, webhooks/*, upload/*, cron/*)
│       │   └── proxy.ts            # Next 16 미들웨어 (3도메인 Host 분기 + 쿠키 검증 + 슬라이딩 재발급 + 운영 /admin 호스트 가드)
│       └── package.json
│
├── packages/
│   ├── db/                         # @repo/db (PostgreSQL 18 Drizzle 스키마 + DAL Repositories)
│   │   └── src/
│   │       ├── repos/              # 도메인별 순수 DAL Repository (*Repo.ts)
│   │       ├── schema/             # Drizzle pg-core 테이블 스키마 (SSOT)
│   │       ├── client.ts           # PostgreSQL 18 직접 연결 Drizzle Client (node-postgres / pg)
│   │       └── index.ts
│   ├── types/                      # @repo/types (ActionResult, AppError, web↔admin 교차 계약)
│   └── ui/                         # @repo/ui (테마 없는 shadcn/ui 구조 프리미티브)
│
├── .agents/                        # AG-Kit 런타임 & 통합 스킬셋
├── .docs/                          # 5대 표준 문서 (architecture / specs / data / plan / history)
├── .scratch/                       # 일회성 Python(uv) 및 외부/레거시 참조(references/) 격리 폴더 (Git 제외, 직접 import 금지)
├── .node-version                   # Node.js 버전 고정 (v24.14.1)
├── .env                            # 모노레포 단일 환경변수 (PostgreSQL/외부키 — Git 제외)
├── .env.example                    # 환경변수 템플릿 (Git 커밋 대상)
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

## 4. 거버넌스, 인증(`proxy.ts`) 및 세션 이원화 표준

- **패키지 & 폴더 경계 분리 거버넌스**: 내부 패키지는 `@repo/*` + `"workspace:*"`만 사용하며 `any` 사용을 금지합니다. `apps/web/src/` 내부의 `web/`(사용자)과 `admin/`(관리자) 폴더 및 `styles/web.css` ↔ `styles/admin.css` 간 직접 import를 엄격히 금지하여, 추후 `apps/admin` 분리 시 1:1 이동이 가능하도록 유지합니다.
- **세션 쿠키 & Path 물리 분리**:
  - 사용자: `WAGGLE_APP_SESSION` (`path: "/"`)
  - 관리자: `WAGGLE_ADMIN_SESSION` · `WAGGLE_ADMIN_OTP` (**`path: "/admin"`** — 사용자 페이지 요청에 관리자 쿠키 노출 차단)
- **공통 DB SHA-256 세션 엔진 ([`.scratch/references/2026-11-16_LOGIN_PROCESS_STANDARD.md`](file:///.scratch/references/2026-11-16_LOGIN_PROCESS_STANDARD.md))**:
  - 로그인 성공 시 **32바이트 무작위 키**를 쿠키(`HttpOnly; Secure; SameSite=Lax`)에 저장하고 DB에는 **SHA-256(hex)**만 저장합니다.
  - 정책 상수는 `00_lib/userSessionConfig.ts` · `00_lib/adminSessionConfig.ts` 단일 파일에만 둡니다(숫자 하드코딩 금지).
- **사용자/관리자 세션 이원화 규칙**:
  1. **`(mobile)` `/app/*` 사용자**:
     - **로그인 수단**: 이메일 + 소셜 로그인 (카카오/Apple 등).
     - **중복 로그인 금지 (`singleSession: true`)**: 새 로그인 시 기존 활성 세션을 `revoked_reason = 'DUPLICATE_LOGIN'`으로 즉시 종료하고, 기존 기기 요청 시 `/api/auth/session-expired?reason=duplicate`를 거쳐 로그인 화면에서 `useAlert`로 안내합니다.
     - **자동 로그아웃 제한 없음 (`idleMs: null`, `absoluteMs: null`)**: DB 세션 자체는 만료되지 않으며, 브라우저 400일 쿠키 상한을 고려해 쿠키 `maxAge`를 `365일`로 설정하고 방문 시 `proxy.ts`에서 주기적으로 슬라이딩 재발급합니다.
     - **강제 무효화 트리거**: 비밀번호 변경 · 계정 정지(`SUSPENDED`) · 회원 탈퇴 시 해당 유저의 활성 DB 세션을 즉시 `SECURITY_RESET`으로 폐기합니다.
  2. **`(admin)` `/admin/*` 관리자 (`ADMIN` / `TRAINER`)**:
     - `LOGIN_PROCESS_STANDARD` 100% 준수: ID/PW ➔ **2단계 문자 인증번호(OTP)** ➔ **30분 슬라이딩 만료** · **단일 세션** · 비밀번호/OTP 합계 **5회 오답 시 계정 잠금**.
- **Next.js 16 `proxy.ts` & 3-Tier Guard**:
  1. `src/proxy.ts`: 3도메인 Host 분기(`app.*` ➔ `/app/*`, `admin.*` ➔ `/admin/*` rewrite; 운영 환경에서 `admin.*` 외 호스트의 `/admin` 직접 접근은 404 차단), 세션 쿠키 유무 확인 및 슬라이딩 쿠키 재발급.
  2. `layout.tsx` / `page.tsx`: React `cache()` 기반 `getCurrentSession()` DB 검증 (만료/중복 폐기 쿠키는 `/api/auth/session-expired`로 정리하여 무한 리다이렉트 원천 차단).
  3. `03_actions` & `04_services`: 외부 입력의 `userId`를 신뢰하지 않고 검증된 세션의 `userId`/`adminId`만 강제 주입합니다 (IDOR 원천 차단). `04_services`는 Public(`*MasterService.ts`)과 Private(`my*Service.ts`) 및 `admin/`으로 분리합니다.

---

## 5. 데이터 레이어(PostgreSQL 18 직접 연결), ACID 결제 · Cron 표준 및 불변 규칙

개발 및 운영 환경 모두 **PostgreSQL 18(`drizzle-orm/node-postgres` + `pg`)에 직접 연결**하며(Mock DB 사용 안 함), 모든 쿼리는 `packages/db/src/repos/*Repo.ts` 내부에만 캡슐화하고 환경변수는 **루트 `.env` 단 한 곳**에서 통합 로드합니다.

- **별도 API / Worker / Redis 서버 제거 원칙 (KISS)**:
  - 별도 NestJS 서버, Redis, BullMQ `worker` 프로세스를 두지 않습니다.
  - 일반 CRUD 및 결제·포인트 정산은 **`03_actions` ➔ `04_services` ➔ PostgreSQL `db.transaction`**으로 처리합니다.
  - 외부 HTTP 진입점이 필수인 경우만 예외적으로 **Next.js Route Handlers (`app/api/*`)**를 사용합니다:
    1. **결제 웹훅 (`/api/webhooks/*`)**: 서명 검증 ➔ PG 재조회 대조 ➔ **단일 PostgreSQL ACID 트랜잭션**(`payment_event_logs` UNIQUE 멱등 + 주문 `PAID` + `point_ledgers` INSERT + 잔액 UPDATE) ➔ 응답 후 Next.js `after()`로 단건 알림.
    2. **소셜 OAuth 콜백 (`/api/auth/callback/*`)** 및 **파일 업로드/Presign (`/api/upload/*`)**.
    3. **Firebase/GCP Cloud Scheduler 정기 배치 (`/api/cron/*`)**: 포인트 일일 소멸·SLA 체크 등은 Cloud Scheduler가 `CRON_SECRET` 헤더(또는 OIDC 토큰)로 `/api/cron/*`을 직통 호출합니다.

### 핵심 도메인 불변 규칙 (Domain Invariants)
1. **참조 데이터 삭제 원천 차단 & 소프트 삭제 복원 (`is_deleted` + `audit_logs`)**:
   - 하위 결제·주문·원장 등 연결 내역이 있는 데이터는 삭제 자체를 원천 차단합니다.
   - 허용된 삭제 건은 물리 `DELETE` 대신 **`is_deleted = true`(`deleted_at`, `deleted_by`)로 `UPDATE`**하여 일반 조회·집계에서 100% 제외하고 `audit_logs`에 기록해 관리자 `[삭제 이력 / 복원]`에서만 복원합니다 (PostgreSQL 네이티브 부분 유니크 인덱스 `WHERE is_deleted = false`로 재등록 충돌 방지).
2. **포인트 원장(Ledger) 정합성 & 음수 잔액 금지**:
   - 잔액 단순 덮어쓰기를 금지하며 모든 충전/적립/사용/환불/소멸은 `point_ledgers` 원장 기록과 잔액 갱신을 단일 `db.transaction`으로 원자적 처리합니다 (`balance < 0` 절대 불가).
3. **중복 지급·결제 차단 (Idempotency)**:
   - 외부 결제 웹훅, 리워드/미션 지급은 DB `UNIQUE` 멱등키(`event_id` 또는 `user_id + target_id + period_key`)로 중복 실행을 원천 차단합니다.
4. **반려견 프로필 소유권 및 대표견 유지**:
   - 모든 반려견 데이터 수정/삭제는 세션 본인(`userId`) 소유를 검증하며 대표 반려견(`is_primary`) 정합성을 유지합니다.
5. **포인트샵 주문 및 재고/잔액 원자적 검증**:
   - 주문 생성 시 ① 판매 상태·재고 확인 ➔ ② 잔액 검증 ➔ ③ 재고/포인트 차감 원장 기록 및 주문 생성을 단일 트랜잭션으로 처리합니다.

---

## 6. UI/UX 핵심 표준 (사용자/관리자 분리 & 전역 MD 수치 기록 금지)

- **전역 MD 시각 수치 기록 금지 (Visual Token SSOT)**: `AGENTS.md` · `.agents/rules/*` · `.agents/memory/*` · `DESIGN.md` 허브 등 전역 문서에는 **폰트 스타일(폰트명·크기·굵기)·`px`/`rem` 치수·패딩/마진·컬러 코드·라운드·모션 수치를 직접 기록하지 않습니다.** 모든 시각 스펙은 오직 전용 SSOT([`DESIGN_WEB.md`](file:///.docs/architecture/DESIGN_WEB.md) · [`DESIGN_ADMIN.md`](file:///.docs/architecture/DESIGN_ADMIN.md) · [`APP_SHEET_FRAME_GUIDE.md`](file:///.docs/architecture/APP_SHEET_FRAME_GUIDE.md))와 각 영역 CSS(`styles/web.css`, `styles/admin.css`)에만 단일 관리합니다.
- **사용자 ↔ 관리자 디자인 100% 물리 분리 (독립 Root Layout + 전용 CSS)**:
  - **사용자 (`(www)` + `(mobile)` `/app/*`)**: Clean Neo-Pop 전용 SSOT([`DESIGN_WEB.md`](file:///.docs/architecture/DESIGN_WEB.md)) + `styles/web.css` + 모바일 쉘([`APP_SHEET_FRAME_GUIDE.md`](file:///.docs/architecture/APP_SHEET_FRAME_GUIDE.md)) 적용.
  - **관리자 (`(admin)` `/admin/*`)**: Atlas Precision Studio 전용 SSOT([`DESIGN_ADMIN.md`](file:///.docs/architecture/DESIGN_ADMIN.md)) + `styles/admin.css` + `corenuri-ui-standards` 적용. 사용자 스타일 혼입 금지.
  - **`@repo/ui`**: 색상·치수 하드코딩 없이 각 영역 CSS 변수 슬롯만 소비하는 구조/접근성 프리미티브만 공유합니다.
- **전 영역 공통 가드레일**:
  - **UI 내 유니코드 이모지 전면 금지**: 전 화면에서 `lucide-react` 단색 SVG 또는 커스텀 브랜드 SVG만 사용합니다.
  - **선언된 `rem` 토큰 & 정적 Tailwind 전용**: 인라인 스타일 및 임의 수치/색상 하드코딩, 동적 Tailwind 클래스 조합을 금지하고 선언된 `rem` 스케일·시맨틱 토큰만 사용합니다.
  - **폼 & 전역 Alert**: `<html lang="ko" suppressHydrationWarning>`, `<form noValidate>`, `window.alert()` 대신 Zustand `useAlert`(`closeOnOverlayClick={false}`) 및 `useRef` + 비동기 포커스 제어를 적용합니다.
  - **수치 가독성 & 인터랙션**: 동적 수치 `tabular-nums` 필수 · 비흰색 컨테이너 무경계 원칙 · 터치 피드백 및 접근성 명암비(WCAG) 준수.

---

## 7. 런타임·코어 버전 표준 및 작업 완료 프로토콜

- **패키지 매니저 원칙 (★pnpm 전용 — `npm`/`yarn`/`npx` 절대 금지★)**: 의존성 설치·추가·실행은 오직 **`pnpm`**(`pnpm install`, `pnpm add`, `pnpm run`, `pnpm dlx`)만 사용합니다.
- **Python(`uv`) 및 `.scratch/` 격리 원칙**: 파이썬은 반드시 **`uv`**만 사용하며, 일회성 파이썬 스크립트·가상환경(`.venv`/`pyproject.toml`)은 **`.scratch/` 내부**(`uv add/run --project .scratch ...`)에서 실행하고, 외부 참조 표준 문서는 **`.scratch/references/`**에 보관합니다.
- **초기 설치 및 코어 버전 고정 (필수 준수)**:
  - **Node.js (`fnm default` 조회 ➔ `.node-version` 필수 유지)**: 로컬 `fnm` `default` 버전(`v24.14.1`)을 루트 **`.node-version`**에 고정하고, 루트 `package.json`의 `"engines.node"`도 `"24.x"`로 고정합니다 (`">=20"` 등 상한 없는 범위 엄격 금지).
  - **Package Manager & Build**: `"packageManager": "pnpm@12.5.1"`, `"turbo": "^2.5.0"`, `"typescript": "^5.8.2"`.
  - **Framework & UI 버전**: **`"next": "16.2.6"`** (캐럿 `^` 없이 고정 — Firebase App Hosting 호환성 보장), **`"react": "^19.0.0"`**, **`"react-dom": "^19.0.0"`**, `"tailwindcss": "^4.1.0"`, `"zustand": "^5.0.3"`, `"@types/node": "^22.13.0"`.
- **Turbo Strict Env**: 신규 환경변수(`NEXT_PUBLIC_*`, `CRON_SECRET` 등) 추가 시 반드시 `turbo.json`의 `tasks.build.env` 배열에 함께 등록합니다.
- **검증 의무**: 코드 변경 후 반드시 `pnpm typecheck`으로 전체 워크스페이스 타입 에러 0건을 확인합니다.
- **문서 동기화 및 보고**:
  1. 작업 완료 시 `.docs/history/YYYY-MM-DD.md` 및 [`.docs/history/index.md`](file:///.docs/history/index.md) 갱신.
  2. 설계 플랜 생성 시 `.docs/plan/YYYY-MM-DD_제목.md` 작성 및 [`.docs/plan/index.md`](file:///.docs/plan/index.md) 등록.
  3. 모든 수정 응답 하단에 `[파일명:L시작-L끝](file:///절대경로#L시작-L끝)` 클릭형 라인 링크 및 1줄 요약 제공.
