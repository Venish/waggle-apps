# 00. 와글(Waggle) 마스터 설계서 (SSOT v1.0)

> **문서 상태:** 확정 (Active SSOT)  
> **작성일:** 2026-11-21  
> **기반 분석:** [01_레거시_기능분석_및_재기획_초안.md](./01_레거시_기능분석_및_재기획_초안.md) · 디자인 SSOT: [`.docs/architecture/DESIGN.md`](../architecture/DESIGN.md)

---

## 1. 서비스 비전 및 핵심 가치 루프

**"듀오링고처럼, 우리 강아지에게 맞는 커리큘럼으로 매일 조금씩 교육하고 기록한다."**

```text
[www 소개페이지 (심플 랜딩)] ──▶ 앱 바로가기 / QR 진입
                                       │
                                       ▼
온보딩 (반려견 프로필 + 7문항 설문 + 태그 매칭 + 선택 레벨테스트 + 데일리 목표)
  ──▶ [레슨 루프] YouTube 영상(95% 시청) ➔ 실습(자가체크) ➔ 4지선다 퀴즈
  ──▶ 단계별 포인트 적립 (1년 FIFO 유효기간) + 배지 / 강아지 학년 갱신
  ──▶ 포인트 사용: 포인트샵(실물 제휴 / 디지털 상품) · 훈련사 비동기 영상 Q&A
  ──▶ 보조 기능: 일상기록(캘린더 · 접종 · 산책체크 · 사진/메모)
```

---

## 2. 3영역 서비스 아키텍처 & 전체 IA (1-App + 3-Domain, 추후 `apps/admin` 분리 대비)

> 단일 서버 운영 효율을 위해 **`apps/web` (`:3000`) 단일 Next.js 16 앱** 안에 3개 Route Group을 배치하되, **독립 Root Layout · 전용 CSS(`styles/web.css` vs `styles/admin.css`) · `web/` vs `admin/` 폴더 경계 · `path: "/admin"` 쿠키**로 100% 물리 격리하여 추후 `apps/admin`으로 즉시 분리할 수 있게 설계한다.

| 영역 | Route Group / 도메인 | 역할 및 대상 사용자 | UI / 디자인 SSOT |
| :--- | :--- | :--- | :--- |
| **`(www)` 소개** | `apps/web` `(www)` (`www.*` / `/`) | **심플 마케팅 랜딩**: 브랜드 소개 · 핵심 교육/포인트 기능 안내 · 앱 바로가기/QR | `DESIGN_WEB.md` (`styles/web.css`, Clean Neo-Pop) |
| **`(mobile)` 앱** | `apps/web` `(mobile)` (`app.*` / `/app/*`) | **보호자(USER) 메인 서비스**: 온보딩 · 교육 · 기록 · 데일리 · Q&A · 지갑 · 포인트샵 · 마이 | `DESIGN_WEB.md` (`styles/web.css`, Fluid REM + `AppSheetFrame`) |
| **`(admin)` 콘솔** | `apps/web` `(admin)` (`admin.*` / `/admin/*`) | **관리자(`ADMIN`)** 전 운영 기능 + **훈련사(`TRAINER`)** 제한 포털(Q&A 답변·본인 정산) | `DESIGN_ADMIN.md` (`styles/admin.css`, Atlas Precision Studio) |

### 2.1 `(www)` 소개페이지 IA (Option 1-A 확정 — 심플 랜딩)
1. **Hero Section**: 브랜드 메시지 + Clean Neo-Pop 5색 팝 파스텔 그래픽 + `[앱 시작하기]` CTA & 모바일 QR 코드
2. **Core Loop Showcase**: 3단계 핵심 교육 루프(영상 시청 ➔ 자가 실습 ➔ 퀴즈 & 포인트) 시각화
3. **Key Features**: 맞춤 커리큘럼 매칭 · 강아지 학년/배지 · 포인트샵 · 훈련사 1:1 영상 Q&A 요약 카드
4. **Bottom CTA & Footer**: 앱 바로가기 / 사업자 정보 / 이용약관·개인정보처리방침 링크

### 2.2 `app/` 모바일 웹앱 IA (기존 36개 라우트 100% 계승 · 5-Tab)
- **온보딩 (`/app/onboarding/*`)**: 인트로 · 로그인/가입 · 반려견 프로필 · 7문항 설문 · 선택 레벨테스트 · 매칭 결과 · 데일리 목표 설정
- **탭 1 — 교육 홈 (`/app`, `/app/courses/*`, `/app/lesson/[id]/*`)**: 듀오링고식 학습 경로, 코스 목록/상세, 레슨 루프(`watch` · `practice` · `quiz`)
- **탭 2 — 기록 (`/app/record/*`)**: 교육 기록 허브 · 획득 배지 · 강아지 학년(교육 이수도 기반)
- **탭 3 — 일상 (`/app/daily/*`)**: 데일리 캘린더 · 접종 기록 · 산책 체크 · 스티커/사진/자유 기록 (포인트 미연동)
- **탭 4 — 포인트샵 (`/app/shop/*`, `/app/wallet/*`)**: 실물/디지털 상품 탐색 · 장바구니 · 주문/배송 조회 · 포인트 지갑 · 충전(웹 PortOne / 앱 IAP 채널 가격 차등)
- **탭 5 — 마이 (`/app/my/*`, `/app/inquiry/*`)**: 반려견 관리(다견/대표견) · 훈련사 비동기 영상 Q&A · 데일리 목표 · 알림함 · 설정

### 2.3 `admin` 운영 콘솔 IA (기존 31개 라우트 100% 계승 · 2-Role RBAC)
- **`ADMIN` 전용**: 대시보드 · 회원/반려견 관리 · 커리큘럼 CMS(코스/유닛/레슨/체크리스트/퀴즈) · 온보딩 설문/태그/가중치/매칭 시뮬레이터 · 훈련사 관리/배정/월 정산 · 상품/카테고리/주문·배송 · 정책 설정(`PolicyConfig` + 이력) · 알림 템플릿/발송 · 배너 · 공통코드 · 관리자 계정 · 삭제 복원 & 감사로그(`audit_logs`)
- **`TRAINER` 전용 포털 (`/trainer/*`)**: 배정된 비동기 영상 Q&A 답변(48h SLA) · 본인 월 정산 내역 조회

---

## 3. 10대 도메인 핵심 기능 및 불변 규칙 (기존 2~8번 100% 계승 + Phase 0 표준 결합)

| 도메인 코드 | 도메인 명칭 | 핵심 비즈니스 규칙 및 아키텍처 기준 |
| :---: | :--- | :--- |
| **DOM-01** | **인증 · 세션 · 권한** | 공통 DB SHA-256 세션 엔진 (`32B 무작위 키 쿠키` ↔ DB `SHA-256`).<br/>• `app` (`WAGGLE_APP_SESSION`): 이메일 + 소셜(카카오/Apple), **중복 로그인 금지(`DUPLICATE_LOGIN` 기존 기기 안내)**, **자동 로그아웃 제한 없음(`idleMs: null`, 쿠키 `maxAge: 365일` 슬라이딩 재발급)**, 비번변경/정지/탈퇴 시 즉시 폐기.<br/>• `admin` (`WAGGLE_ADMIN_SESSION`, `WAGGLE_ADMIN_OTP`): `LOGIN_PROCESS_STANDARD` 100% (ID/PW + 문자 2FA + 30분 슬라이딩 + 단일 세션 + 5회 잠금), `ADMIN`/`TRAINER` RBAC. |
| **DOM-02** | **반려견 · 일상 · 접종** | 한 계정 다견 지원 + 대표견(`is_primary`) 정합성 유지. 월령 자동 태그(`puppy/adolescent/adult/senior`), 기념일 D-Day, 데일리 캘린더·스티커·접종 기록(포인트 미연동). |
| **DOM-03** | **온보딩 · 설문 · 매칭 · 레벨테스트** | 7문항 객관식 비분기 설문(관리자 편집) ➔ 룰 기반 태그 가중치 점수 매칭(`matching/score.ts`) ➔ 선택 레벨테스트(통과 레벨 이하 일괄 이수 처리). |
| **DOM-04** | **교육 커리큘럼 · 레슨 루프** | `Course ➔ Unit ➔ Lesson(영상·실습·퀴즈)`. YouTube Unlisted + IFrame Player API(95% 시청, 배속 허용) ➔ 실습 자가체크 ➔ 4지선다 퀴즈(3~5문항, 통과 기준 정책 설정). 진도는 **Dog 기준**, 코스 동시 수강 허용 · 코스 내 순차 잠금. |
| **DOM-05** | **게이미피케이션 (목표·배지·학년)** | 레슨 완료 트랜잭션 내 동기 평가(별도 Worker 제거): 데일리 목표 달성, 교육 이수도 기반 강아지 학년, 코스/유닛 완주 배지 즉시 부여. |
| **DOM-06** | **훈련사 비동기 영상 Q&A · 정산** | 보호자 영상+질문 업로드(문의권/포인트 차감) ➔ 훈련사 48h 내 답변 ➔ SLA 초과 시 자동 포인트 환불(Cloud Scheduler `/api/cron/inquiry-sla`). 훈련사 월 정산(차감 포인트 × 정산 비율, `PolicyConfig`). |
| **DOM-07** | **포인트 원장 · 충전 (PG / IAP)** | 적립(시청/실습/퀴즈 각 최초 1회 + 완주 보너스) + 현금 충전(웹 PortOne / 앱 IAP 채널별 가격 차등·스티어링 금지). **PostgreSQL 18 단일 ACID 트랜잭션 + UNIQUE 멱등키** (`balance < 0` 불가). 적립일 + 1년 FIFO 선입선출 소멸(Cloud Scheduler `/api/cron/expire-points`). |
| **DOM-08** | **포인트샵 · 주문 · 배송** | 상품 유형 3종: 실물 제휴(옵션·장바구니·배송지·송장) + 훈련사 문의권 + 프리미엄 코스 잠금해제(`course_unlocks`). 주문 시 판매상태/재고 ➔ 포인트 잔액 ➔ 차감 원장·주문 생성을 단일 트랜잭션 처리. |
| **DOM-09** | **알림 · 푸시 · Android Shell** | 단건 알림은 응답 후 Next.js `after()` 처리, 데일리 리마인드·포인트 소멸 사전 알림(30일/7일 전)은 Cloud Scheduler `/api/cron/*`. `android-shell`(WebView + FCM + `window.WaggleBridge`)은 쿠키 영속화 세션과 호환 유지. |
| **DOM-10** | **운영 공통 · 정책 · 감사/복원** | 모든 정책값(포인트 단가·보너스·충전 패키지·문의권 가격·정산 비율·퀴즈 기준)은 `policy_configs` + 이력 관리(하드코딩 금지). 전 테이블 7대 감사 컬럼 + 참조 삭제 차단 + `is_deleted` 소프트삭제/`audit_logs` 관리자 복원 + 부분 유니크(`WHERE is_deleted = false`). |

---

## 4. 기술 스택 및 인프라 불변 기준 (Phase 0 확정)

- **Monorepo**: Turborepo v2 + `pnpm@12.5.1` + Node `v24.14.1` (`.node-version`) + Next.js `16.2.6` + React `^19.0.0` + Tailwind v4 `^4.1.0` + Zustand `^5.0.3`
- **Packages**: `@repo/db` (PostgreSQL 18 `drizzle-orm/node-postgres` + `pg` 직접 연결, Mock 폐지) · `@repo/types` (`ActionResult`, `AppError`, 교차 계약) · `@repo/ui` (shadcn/ui)
- **Server Architecture**: 별도 NestJS · Redis · BullMQ `worker` 없음
  - 내부 CRUD · 포인트/결제/주문 정산: `03_actions` (Server Actions) ➔ `04_services` (`server-only`) ➔ PostgreSQL `db.transaction`
  - 예외 HTTP 진입점 (`app/api/*`): `/api/webhooks/portone`, `/api/auth/callback/*`, `/api/auth/session-expired`, `/api/upload/presign`, `/api/cron/*` (Firebase/GCP Cloud Scheduler `CRON_SECRET` 인증)
- **순수 도메인 계산 엔진 이식**: `.scratch/references/waggle_apps-main/packages/domain/src/`의 7종 순수 로직(`age-tag`, `dday`, `grade`, `education/progress`, `matching/score`, `points/fifo`, `quiz/grade`)은 프레임워크 무의존 순수 TS이므로 테스트와 함께 신규 `@repo/types` 또는 `04_services`로 클린 이식한다.

---

## 5. 단계별 실행 로드맵 (4-Stage + 2-Wave)

### 5.1 전체 구축 4단계 (Code-Zero First)
| 단계 | 목표 | 핵심 산출물 |
| :---: | :--- | :--- |
| **Stage 1** | **상세 설계 MD 완성** | `.docs/plan/details/` 태스크보드 · `GRILL_ME_결정대장` · 도메인별 `01_table.md`(PostgreSQL 18) · `02_feature.md` · `03_screen.md` (및 필요 시 `.scratch/spec_verifier` 검증) |
| **Stage 2** | **모노레포 · PostgreSQL 18 셋팅** | Turborepo + `apps/web`(3 Route Group + `styles/web.css`·`admin.css`) + `@repo/db`(Drizzle 스키마/마이그레이션) + `@repo/types` + `@repo/ui` 초기화 |
| **Stage 3** | **공통 디자인 시스템 구축** | [DESIGN_WEB.md](../architecture/DESIGN_WEB.md) (`styles/web.css`: `www`·`app` Clean Neo-Pop) · [DESIGN_ADMIN.md](../architecture/DESIGN_ADMIN.md) (`styles/admin.css`: `admin` Atlas Precision Studio) 물리 분리 구축 |
| **Stage 4** | **도메인 본 코딩 (Wave 1 ➔ Wave 2)** | 기능은 100% 설계하되 외부 심사/연동 의존도에 따라 2개 Wave로 안전하게 구현 |

### 5.2 Stage 4 구현 Wave 분리 (기능 누락 0% · 블로킹 방지)
- **Wave 1 (코어 오픈 — 웹 우선 완결)**:
  - `DOM-01` 인증/세션 이원화 · `DOM-02` 반려견/데일리/접종 · `DOM-03` 온보딩/설문/매칭/레벨테스트 · `DOM-04` 교육 커리큘럼/레슨 루프 · `DOM-05` 게이미피케이션 · `DOM-07` 포인트 원장 & 웹 PortOne 결제 · `DOM-10` 운영 공통/정책/감사 · **`(www)` 심플 랜딩**
- **Wave 2 (수익화 확장 · 스토어 채널)**:
  - `DOM-08` 포인트샵(실물 배송 커머스 + 디지털 상품) · `DOM-06` 훈련사 비동기 영상 Q&A & `TRAINER` 포털/월 정산 · `DOM-09` 알림/Cloud Scheduler 배치 고도화 & `android-shell` / 앱 IAP 채널 연동
