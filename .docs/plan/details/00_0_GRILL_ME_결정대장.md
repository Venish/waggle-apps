# 와글(Waggle) 상세 설계 의사결정 대장 (`00_0_Grill_Me_Decisions`)

> **문서 목적**: `T-00 ~ T-11` 상세 설계(`01_table.md` · `02_feature.md` · `03_screen.md`) 중 발생하는 세부 정책·데이터 무결성·UX 동선 쟁점(`Grill-Me` 항목)에 대해, **작업 중단 없이 AI가 실무·KISS 최적안을 선반영**하고 그 선택 내역·대안·반영 파일 위치를 한곳에 기록하는 **일괄/순차 검수·확정 전용 보드**이다.  
> **연결 태스크보드**: [00_0_상세설계_태스크보드.md](./00_0_상세설계_태스크보드.md)

---

## 1. 상태 코드 및 검수 운영 규칙

| 상태 배지 | 의미 및 사용자 액션 기준 |
| :---: | :--- |
| **`[중요정책-검토대기]`** | 금액·환불·권한·삭제/잠금·배정 등 비즈니스 정책에 직접 영향을 주는 선택사항. AI가 가장 안전한 표준안을 선반영해 두었으며 **사용자 우선 확인 권장** |
| **`[AI최적-검토대기]`** | DB 인덱스·세션·예외 처리·기본 UX 동선 등 실무 정석이 명확해 AI가 KISS 최적안을 선반영한 항목. **이견 없으면 일괄 확정 가능** |
| **`[최종확정]`** | 사용자 검토·승인 완료 (설계 고정 완료) |
| **`[변경완료]`** | 사용자가 대안(`B안` 등) 또는 커스텀 지시로 변경하여 연결된 MD 파일까지 모두 역추적 수정 완료된 항목 |

- **일괄 승인**: `"Grill-Me 대기 건 전부 확정해"` 또는 `"T-01 결정사항 확정"` ➔ 대기 항목 `[최종확정]` 전환
- **핀셋 변경**: `"GM-107은 B안으로 바꾸고 나머지는 확정해"` ➔ 반영 대상 MD 역추적 수정 후 `[변경완료]`

---

## 2. 확정 아키텍처 & 정책 대장 (`GM-001 ~ GM-011`, `GM-101 ~ GM-106` — 전원 `[최종확정]`)

### 2.1 Phase 0~1 코어 아키텍처 확정 (`GM-001 ~ GM-011`)
| ID | 분류 | 확정 내용 | 상태 |
| :---: | :---: | :--- | :---: |
| **GM-001** | 아키텍처 | **1-App + 3-Domain / 3-Package**: `apps/web`(`:3000`, 3 Route Group: `(www)` · `(mobile)` `/app/*` · `(admin)` `/admin/*`) + `@repo/db`, `@repo/types`, `@repo/ui`. `web/`·`admin/` 폴더·CSS 물리 격리로 추후 `apps/admin` 무중단 분리 대비 | `[최종확정]` |
| **GM-002** | DB | **Mock 폐지 · PostgreSQL 18 직접 연결**: 개발/운영 모두 `drizzle-orm/node-postgres`(`pg`) PostgreSQL 18 직접 연결, 루트 단일 `.env`, `@repo/db` DAL(`src/repos/*Repo.ts`) 격리 | `[최종확정]` |
| **GM-003** | 결제/배치 | **Worker/Redis 제거**: 결제·포인트는 PostgreSQL 단일 ACID `db.transaction` + `UNIQUE` 멱등키; 외부 웹훅·OAuth·업로드·Firebase/GCP Cloud Scheduler 배치(`/api/cron/*`, `CRON_SECRET`)만 `app/api/*` Route Handlers 처리 | `[최종확정]` |
| **GM-004** | 인증 | **DB SHA-256 세션 이원화**: `app`(`WAGGLE_APP_SESSION`, `path: "/"`)은 이메일/소셜 + **중복로그인 금지(`DUPLICATE_LOGIN`)** + **자동로그아웃 제한 없음(`idleMs: null`, 쿠키 365일 슬라이딩)** / `admin`(`WAGGLE_ADMIN_SESSION`, `path: "/admin"`)은 `LOGIN_PROCESS_STANDARD` 100%(30분 슬라이딩 · 단일세션 · 문자 2FA · 5회 잠금) + 운영 시 비관리자 호스트 `/admin` 404 차단 | `[최종확정]` |
| **GM-005** | 삭제/복원 | **참조 삭제 차단 & 소프트 삭제 복원**: 하위 연결 데이터 존재 시 삭제 원천 차단, 허용 건은 `is_deleted = true` UPDATE + `audit_logs` 기록 + PostgreSQL 부분 유니크(`WHERE is_deleted = false`, 관리자 History 복원) | `[최종확정]` |
| **GM-006** | 스펙 범위 | **`(www)` 심플 랜딩(1-A) + 기존 2~8번 100% 계승**: 구현만 `Wave 1`(코어+웹 PortOne) ➔ `Wave 2`(포인트샵 실물·훈련사 Q&A/정산·Android Shell/IAP) 분리 | `[최종확정]` |
| **GM-007** | 디자인 분리 | **사용자/관리자 디자인 100% 물리 분리**: 사용자 `styles/web.css`(`DESIGN_WEB.md`, Clean Neo-Pop 5색 팝 파스텔 OKLCH, 파스텔 위 `ink` 강제) vs 관리자 `styles/admin.css`(`DESIGN_ADMIN.md`, Atlas Precision Studio Warm-Neutral OKLCH `H=70`, Dark-First/Light) | `[최종확정]` |
| **GM-008** | 스타일 거버넌스 | **전역 MD 시각 수치 기록 금지 & REM-Only**: 전역 MD에는 폰트·`px`/`rem`·컬러 수치 직접 기록 금지; 컴포넌트는 선언된 `rem` 토큰 및 Tailwind v4 기본 스케일만 사용(임의 `px` 금지, 이모지 전면 금지) | `[최종확정]` |
| **GM-009** | 레거시 격리 | 구버전 기획서 24종은 `.docs/specs/legacy/`, 구버전 소스(`waggle_apps-main`)는 `.scratch/references/waggle_apps-main/`에 격리(직접 import 금지) | `[최종확정]` |
| **GM-010** | 진행 방식 | **Option C 채택**: 컨트롤 타워 지도(`T-00`) ➔ 도메인 무관 뼈대 & 디자인 쉘 눈 검증(`Stage 1B`) ➔ ERP식 10도메인 상세설계 `0 FAIL`(`Stage 2`) ➔ Wave 1·2 본 코딩(`Stage 3`) | `[최종확정]` |
| **GM-011** | 설정/상수 | **코드 기본 상수·Fallback 0% (Strict `.env` + Strict PostgreSQL `policy_configs`, Fail-Fast)**: 코드 내부에 정책 기본값 하드코딩·Fallback을 전면 금지한다. 인프라·세션 상수는 루트 `.env`(부팅 시 Zod 검증), 비즈니스 운영 정책은 PostgreSQL `policy_configs`(`seed.ts` 초기 적재 ➔ `/admin/policies` 조정 ➔ 오픈 시 확정 고정) 단일 원천에서만 읽으며, 누락 시 즉시 명시적 에러(Fail-Fast)로 중단한다 | `[최종확정]` |

### 2.2 Stage 1A 선도출 쟁점 확정 (`GM-101 ~ GM-106` — 전원 A안 `[최종확정]`)
| ID | 대상 폴더 | 분류 | 쟁점 요약 | 확정 내용 (A안) | 상태 |
| :---: | :---: | :---: | :--- | :--- | :---: |
| **GM-101** | `00_2` 전역 | 실무정석 | PostgreSQL 18 PK 전략 (구 `UUID v7` 대체) | 전 테이블 **`BIGINT GENERATED ALWAYS AS IDENTITY`** 단일 대리키 적용 | `[최종확정]` |
| **GM-102** | `01_기반` | 중요정책 | 사용자 소셜 로그인 1차 활성화 범위 | 스키마는 `EMAIL/KAKAO/APPLE/NAVER/GOOGLE` 수용, Wave 1은 **이메일 + 카카오 + Apple** | `[최종확정]` |
| **GM-103** | `06_포인트` | 중요정책 | 충전 포인트 환불 정책 | **미사용 충전분 결제 후 7일 이내 전액 PG 취소**, 부분 사용 시 잔여 충전분만 관리자 수동 환불 승인(적립 포인트 환불 불가). 환불 금액은 원본 거래의 실제 결제/차감액(`paid_points`) 기준 | `[최종확정]` |
| **GM-104** | `08_훈련사` | 중요정책 | 비동기 영상 Q&A 훈련사 배정 방식 | **분야 태그 매칭 추천 + 관리자 수동 배정** 기본(자동 배정 전환 포함 — **관리자 `/admin/policies` PostgreSQL `policy_configs`의 `inquiry.assignment_mode`로 설정**, 코드 Fallback 없음) | `[최종확정]` |
| **GM-105** | `04`/`06` | 중요정책 | 포인트 단가 · 퀴즈 통과율 · 일일 상한 | **전 항목 PostgreSQL `policy_configs`(`/admin/policies`)에서 관리** (`seed.ts` 초기 참고값: 시청 `30P` · 실습 `20P` · 퀴즈 `50P` · 유닛 `100P` · 코스 `300P` · 통과율 `80%` · 일일상한 `500P`, 코드 기본 상수 없음 · 오픈 시 확정 고정) | `[최종확정]` |
| **GM-106** | `03_온보딩` | 실무정석 | 온보딩 레벨테스트 형식 및 보너스 | **4지선다 객관식(코스별 5~10문항)**, 통과 기준 및 보너스 지급 여부/금액(`level_test.pass_score_pct`, `level_test.bonus_enabled`, `level_test.bonus_points`)은 **PostgreSQL `policy_configs`(`/admin/policies`)에서 설정**(초기 시드 `80%` · 보너스 `false/0P` · 코드 기본 상수 없음) | `[최종확정]` |

---

## 3. 자율 완주 추가 선반영 결정 (`GM-107 ~ GM-112`)
| ID | 대상 영역 | 분류 | 쟁점 요약 | 선반영 확정 내용 | 상태 |
| :---: | :---: | :---: | :--- | :--- | :---: |
| **GM-107** | `(mobile)` UI | 디자인확정 | 하단 푸터(`BottomNavBar`) 스타일 | **A안: 플로팅 리퀴드 글래스모피즘 + 활성 탭 모핑 필** (`waggle-app-ui` 스킬 · `DESIGN_WEB.md` 반영) | `[최종확정]` |
| **GM-108** | 외부 연동 | 개발/검증 | Firebase FCM · SMS OTP · PortOne · 소셜 OAuth · 파일 업로드 | **어댑터 경계 유지 + 개발 전용 Mock 어댑터** (`00_lib/adapters.ts`), DB ACID·웹훅 경로는 100% 실제 실행 | `[최종확정]` |
| **GM-109** | `01_기반` | 실무정석 | 비밀번호 해싱 알고리즘 | Node.js 내장 `crypto.scryptSync` + 16B 랜덤 솔트 (네이티브 바이너리 충돌 0%, OS 무의존) | `[AI최적-검토대기]` |
| **GM-110** | `04_교육` | QA효율 | YouTube IFrame 95% 시청 로컬 검증 | 실제 YouTube IFrame + 95% 판정 로직 유지, `NODE_ENV !== "production"`에서만 `[개발용 95% 완료]` 테스트 버튼 병행 제공 | `[AI최적-검토대기]` |
| **GM-111** | `02_반려견` | 실무정석 | 다견 대표견(`is_primary`) 정합성 | `dogs.is_primary` 컬럼 운영, 첫 반려견 자동 `true`, 삭제 시 잔여 최신 반려견 자동 승계 | `[AI최적-검토대기]` |
| **GM-112** | 전체 진행 | 진행전략 | `/goal` 자율 완주 범위 | Wave 1+2 **60테이블 · 70화면 1회 완주** + AI 자체 검증(`typecheck`/`build`/Chrome DevTools) + 최종 E2E 체크 프로세스 제공 | `[최종확정]` |
