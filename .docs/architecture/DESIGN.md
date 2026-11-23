# Waggle Design System Hub (DESIGN.md — Separation Gate)

> **문서 상태:** 활성 (Active SSOT Gate)  
> **핵심 원칙:** 단일 앱(`apps/web`) 내부에서도 **사용자 디자인(`(www)`·`(mobile)`)과 관리자 디자인(`(admin)`)은 독립 Root Layout · 전용 CSS 파일(`styles/web.css` vs `styles/admin.css`) · 컴포넌트 폴더 경계로 100% 물리 분리**하며, **전역 문서(`AGENTS.md`, `.agents/rules/*`, `.agents/memory/*`, 본 허브)에는 구체 폰트 스타일·`px`/`rem` 치수·패딩/마진·컬러 코드를 직접 기록하지 않는다.**

---

## 1. 영역별 디자인 SSOT 라우팅 (단일 진실 공급원)

모든 폰트·치수(`rem`)·패딩/마진·컬러 토큰·라운드·섀도우·모션 수치는 아래 **영역별 전용 SSOT 문서**와 **전용 CSS 파일**에만 단일 관리한다. (추후 서버 증설로 `apps/admin`을 물리 분리할 때도 `styles/admin.css`와 `(admin)` Route Group을 그대로 이식한다.)

| 대상 영역 (`apps/web` Route Group) | 디자인 시스템 명칭 | 전용 SSOT 문서 | 전용 테마 CSS 위치 |
| :--- | :--- | :--- | :--- |
| **사용자** — `(www)` 소개 · `(mobile)` `/app/*` | **Clean Neo-Pop** | [DESIGN_WEB.md](./DESIGN_WEB.md) | `apps/web/src/styles/web.css` |
| **관리자** — `(admin)` `/admin/*` (`ADMIN` · `TRAINER`) | **Atlas Precision Studio** | [DESIGN_ADMIN.md](./DESIGN_ADMIN.md) | `apps/web/src/styles/admin.css` |

- 모바일 웹앱 3단 쉘·오버레이·뒤로가기 방어 상세 규격: [APP_SHEET_FRAME_GUIDE.md](./APP_SHEET_FRAME_GUIDE.md)
- 관리자 백오피스 UX 패턴 스킬: [`.agents/skills/corenuri-ui-standards/SKILL.md`](../../.agents/skills/corenuri-ui-standards/SKILL.md)

---

## 2. 전 영역 공통 불변 가드레일 (Design Governance)

1. **전역 MD 시각 수치 기록 금지 (Single Visual SSOT)**:
   - `AGENTS.md`, `.agents/rules/*`, `.agents/memory/*`, `DESIGN.md` 허브 등 전역 문서에는 폰트명·폰트 크기/굵기·`px`/`rem` 수치·패딩/마진·HEX/OKLCH 컬러·라운드·모션 수치를 직접 적지 않는다(문서 간 불일치 원천 차단).
2. **사용자 ↔ 관리자 디자인 100% 물리 분리 (Independent Root Layouts & Zero Cross-Theme Import)**:
   - 최상위 공통 `app/layout.tsx`에 스타일을 합치지 않고, `(www)`/`(mobile)` Root Layout은 `styles/web.css`만, `(admin)` Root Layout은 `styles/admin.css`만 import한다.
   - `components/web/` ↔ `components/admin/` 간 스타일·컴포넌트 교차 import를 금지한다.
   - `@repo/ui`는 색상·치수 하드코딩 없이 각 영역 CSS 변수 슬롯만 소비하는 구조/접근성 프리미티브만 공유한다.
3. **선언된 `rem` 토큰 & Tailwind v4 기본 스케일 전용 (Token-First Code)**:
   - **사용자와 관리자의 루트 `rem` 설정은 `styles/web.css`와 `styles/admin.css`에서 물리 분리**한다 (`(admin)`·`(www)`는 브라우저 기본 루트 `rem` 고정, `(mobile)` `/app/*`만 전용 스코프 Fluid REM).
   - `.tsx` 컴포넌트에서 인라인 `style`이나 임의 `px`/HEX arbitrary 값 하드코딩을 금지하고, **Tailwind v4 기본 `rem` 유틸리티와 전용 CSS `@theme`에 사전 선언된 `rem`/시맨틱 토큰만** 사용한다 *(예외: hairline border 및 blur 필터)*.
4. **UI 내 유니코드 이모지·이모티콘 전면 금지**:
   - `www` · `app` · `admin` 전 화면에서 유니코드 이모지를 금지하고 `lucide-react` 단색 SVG 또는 커스텀 SVG만 사용한다.
5. **수치 가독성 (`tabular-nums`) & 정적 Tailwind 클래스**:
   - 모든 동적 수치(포인트·금액·수량·진도율·날짜)에 `tabular-nums`를 적용하며, `grid-cols-${n}` 같은 동적 클래스 문자열 조합을 금지한다.
6. **접근성(WCAG) & 정책 상수 분리**:
   - 모든 텍스트·컨트롤은 WCAG AA 이상 명암비를 충족하며, 세션/포인트/SLA 등 운영 정책 수치는 문서·컴포넌트에 하드코딩하지 않고 설정 파일(`00_lib/*SessionConfig.ts`) 또는 DB `policy_configs`에서만 관리한다.
