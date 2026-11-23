# Waggle 개발 로드맵 (02) — 교육앱 MVP 스프린트 상세

작성일: 2026-07-22
버전: v2.0 (교육앱 피벗 전면 재계획 — `기획_교육앱_스펙정의.md` v0.3, `개발계획_01_로드맵.md` v2.0 기반)

> 구 `WGL-MVP-Sxxx`(산책 중심) 태스크는 전부 폐기. 본 문서는 **`WGL-EDU-Sxxx`**로 새로 채번한다.

---

## 사용법

각 스프린트는 2주 단위, 월요일 시작 금요일 종료 (S1 시작: 2026-07-27).
태스크 ID는 `WGL-EDU-Sxxx` 형식으로 지라/GitHub Issue에 이관 가능.

각 스프린트는 다음 5영역으로 구분:

- **BE**: Backend (MAPI / AAPI / Worker / Prisma / Infra)
- **WEB**: `apps/mobile-web` (Next.js 모바일웹 — 구 RN 앱 대체, FE-web)
- **ADM**: `apps/admin-web` (관리자/훈련사)
- **SHELL**: `apps/android-shell` / `apps/ios-shell` (WebView 래퍼)
- **QA/OPS**: 품질/운영

각 태스크에는 `(의존: … / 산출: …)`을 명시한다. 의존이 없으면 생략.

| 스프린트 | 기간 | Phase | 주제 |
|---|---|---|---|
| S1 | 07-27 ~ 08-07 | 1 전환 | DB 백업·Prisma 개정·RN 제거·mobile-web 스캐폴드 |
| S2 | 08-10 ~ 08-21 | 2 교육 코어 | 온보딩(설문+매칭+레벨테스트) + 커리큘럼 CMS |
| S3 | 08-24 ~ 09-04 | 2 교육 코어 | 커리큘럼 홈(경로 UI) + 레슨 플레이어 + 자가체크 |
| S4 | 09-07 ~ 09-18 | 2 교육 코어 | 퀴즈 + 포인트 적립/유효기간 + 정책설정 |
| S5 | 09-21 ~ 10-02 | 3 수익화 | PortOne 충전 + 포인트샵 개편 (추석 버퍼) |
| S6 | 10-05 ~ 10-16 | 3 수익화 | 훈련사 Q&A + TRAINER 롤 + 정산 + 배지/일상기록 |
| S7 | 10-19 ~ 10-30 | 4 출시 | Android shell + 푸시 + QA/부하/스토어 심사 |

---

## Sprint S1 — 전환: 백업·스키마 개정·코드 정리·mobile-web 스캐폴드 (Week 1–2)

스펙 **§11 전환 실행 순서(D23·D24) 1~6단계**를 태스크로 구체화한 스프린트.

### BE

- [ ] WGL-EDU-S001 **[§11-1] DB 백업**: `pg_dump` 전체 덤프 보관 → 스키마 rename으로 `public_backup`·`admin_backup` 생성(데이터 포함, 동결·읽기전용). `waggle_mapi_user`/`waggle_aapi_user`에 backup 스키마 권한 미부여 (산출: 백업 스키마 2종 + 덤프 파일 + 복구 절차 문서)
- [ ] WGL-EDU-S002 **[§11-2] schema.prisma 전면 개편**: 유지 — User/Dog/Breed/PointWallet/PointLedger/Shop·Order 계열/알림/DailyEntry. 신규 — Course/Unit/Lesson/LessonStep/PracticeChecklist/Quiz/QuizQuestion/QuizAttempt/Enrollment/LessonProgress/SurveyQuestion/SurveyAnswer/Tag/CourseTag/AnswerTag/LevelTest/LevelTestAttempt/Trainer/Inquiry/PointRecharge/DailyGoal/Badge/DogBadge (public) + TrainerSettlement/PolicyConfig (admin). PointLedger에 적립원천 enum·`expiresAt` 추가, 진도는 **Dog 기준** (의존: S001 / 산출: schema.prisma v2)
- [ ] WGL-EDU-S003 **[§11-2] 마이그레이션 + 시드**: Walk/WalkPhoto·구 교육 테이블·`walk_path_gix` drop, 신규 테이블 생성. 시드 — Breed 유지, 설문 7문항 초안(스펙 §4.1.1)+태그, PolicyConfig 키 목록(값은 placeholder) (의존: S002 / 산출: 마이그레이션 SQL + seed 스크립트)
- [ ] WGL-EDU-S004 **[§11-3] RN 코드 삭제**: `apps/mobile-app`·`apps/poc-walk`·`packages/native-walk` 디렉터리 삭제, pnpm-workspace/turbo.json/tsconfig 참조 정리 (산출: 삭제 PR, CI 초록)
- [ ] WGL-EDU-S005 **[§11-3] 백엔드 모듈 정리**: MAPI walks·missions 모듈 및 구 education 모듈 제거, AAPI 산책 조회 API 제거. auth/points/shop/notifications 모듈은 유지·회귀 확인 (의존: S003 / 산출: 모듈 제거 PR + 기존 모듈 회귀 테스트 통과)
- [ ] WGL-EDU-S006 domain 패키지 개편: `domain/walks` 삭제, `domain/education`(진도/보상)·`domain/matching`(태그 매칭) 스켈레톤 생성, `dogs/grade.ts` 교체 대상 표기 (의존: S004 / 산출: 패키지 구조 + 빈 테스트 파일)
- [ ] WGL-EDU-S007 worker 큐 개편: `mission-evaluator` → `lesson-evaluator` rename(스켈레톤), walk 이벤트 소비 제거, `video-postprocess`(Q&A용 유지)·`order-fulfillment`·`point-settler`·`notification-dispatcher` 유지 확인 (의존: S005 / 산출: 큐 5종 기동 + 죽은 컨슈머 0)

### WEB

- [ ] WGL-EDU-S010 **[§11-4] `apps/mobile-web` Next.js 15 스캐폴드**: App Router, Tailwind v4 + `@waggle/design-tokens` 공유, 모바일 뷰포트 기준 레이아웃, `@waggle/dto` 연동 (산출: 앱 골격 + 스토리 1페이지)
- [ ] WGL-EDU-S011 인증 연동: 기존 MAPI auth 재사용 — 이메일 + 카카오/애플 웹 OAuth, 토큰 저장 전략(httpOnly 쿠키 + refresh 갱신) (의존: S010 / 산출: 로그인/로그아웃/세션 유지 동작)
- [ ] WGL-EDU-S012 공통 셸: 하단 탭(홈/교육/포인트샵/기록/마이) + 라우팅 골격, TanStack Query 셋업 (의존: S010 / 산출: 탭 내비게이션 골격)

### ADM

- [ ] WGL-EDU-S020 admin-web 산책 관련 화면·메뉴 제거, 기존 회원/상품/주문/배너 화면 회귀 확인 (의존: S005 / 산출: 정리 PR)
- [ ] WGL-EDU-S021 **[§11-6] 문서/CLAUDE.md 갱신**: 모노레포 구조(mobile-web/shell), 스키마, 큐 목록, 명령어 반영. 스펙 §12 폐기 문서 표기 (산출: CLAUDE.md v2 + 문서 개정)

### QA/OPS

- [ ] WGL-EDU-S030 CI 갱신: RN 빌드/테스트 잡 제거, mobile-web lint/typecheck/build 추가 (의존: S004, S010 / 산출: ci.yml)
- [ ] WGL-EDU-S031 스테이징 배포: mobile-web 컨테이너 + Nginx + 도메인(`m-stg.waggle.app`) + 인증서 (의존: S030 / 산출: 스테이징 URL 200)
- [ ] WGL-EDU-S032 백업 검증: 서비스 계정으로 backup 스키마 접근 불가 확인, 복구 리허설 1회 (의존: S001 / 산출: 검증 리포트)

### DoD

- 백업 스키마 동결 + 신규 스키마 스테이징 적용
- 레포에서 RN/산책 코드 0, CI 초록
- mobile-web에서 기존 계정 로그인 성공

---

## Sprint S2 — 온보딩(설문 7문항 + 태그 매칭 + 레벨테스트) + 커리큘럼 CMS (Week 3–4)

### BE

- [ ] WGL-EDU-S101 온보딩 API: 강아지 프로필 등록(기존 `/v1/dogs` 재사용) + 월령·견종 자동 태그화(puppy/adolescent/adult/senior), 설문 조회/응답 저장(단일·복수 선택, 비분기 D17) (의존: S003 / 산출: `/v1/onboarding/*` + OpenAPI)
- [ ] WGL-EDU-S102 `domain/matching` 태그 매칭 엔진: 답변 태그 ↔ 코스 태그 가중치 점수 계산(D9), 순수 함수 + 단위 테스트 85%+ (의존: S006 / 산출: matching 엔진 + 테스트)
- [ ] WGL-EDU-S103 커리큘럼 추천 API: 매칭 점수순 코스 추천, 추천 근거(매칭 태그) 포함 (의존: S102 / 산출: `/v1/curriculum/recommendations`)
- [ ] WGL-EDU-S104 레벨테스트 API: 문항 조회/제출/채점, 통과 레벨 이하 레슨 일괄 이수 처리(D5) — 이수 처리분은 포인트 미지급 (의존: S101 / 산출: `/v1/level-tests/*`, 문항은 O-04 확정분 시딩)
- [ ] WGL-EDU-S105 데일리 목표 API: DailyGoal CRUD(1일 학습량 + 리마인드 시간대), 홈 요약 BFF에 오늘 진행률 포함 (의존: S101 / 산출: `/v1/daily-goal`, `/v1/home/summary`)

### WEB

- [ ] WGL-EDU-S110 온보딩 플로우 UI: 프로필 폼 → 설문 7문항(1문항 1화면, 복수 선택 지원) → 추천 결과(코스 카드 + 매칭 이유) (의존: S012, S101, S103 / 산출: 온보딩 완주 플로우)
- [ ] WGL-EDU-S111 레벨테스트 UI: 선택 진입(경험자용), 결과 화면(시작 위치 안내) (의존: S104 / 산출: 레벨테스트 화면)
- [ ] WGL-EDU-S112 데일리 목표 설정 UI: 학습량 + 푸시 시간대 선택 (의존: S105 / 산출: 목표 설정 화면)

### ADM

- [ ] WGL-EDU-S120 **커리큘럼 CMS**: Course/Unit/Lesson CRUD, YouTube videoId 등록, 코스 태그 지정, 게시/버전 관리(draft→published) — **콘텐츠팀 등록 개시가 목적, S2 내 최우선** (의존: S003 / 산출: CMS 화면 + AuditLog 기록)
- [ ] WGL-EDU-S121 매칭 운영 화면: 설문 문항/선택지/태그/가중치 편집(D16·D17) (의존: S101 / 산출: 설문·태그 관리 화면)

### QA/OPS

- [ ] WGL-EDU-S130 콘텐츠팀 CMS 온보딩: 등록 가이드 작성 + 파일럿 코스 1개(10~15레슨) 등록 검증 (의존: S120 / 산출: 가이드 문서 + 파일럿 코스 데이터)

### DoD

- 신규 유저: 가입 → 프로필 → 설문 → 추천 코스 노출까지 mobile-web 완결
- 콘텐츠팀이 CMS로 파일럿 코스를 스스로 등록
- 매칭 엔진 가중치를 관리자에서 바꾸면 추천 순서 변경 확인

---

## Sprint S3 — 커리큘럼 홈(경로 UI) + 레슨 플레이어(IFrame 95%) + 자가체크 (Week 5–6)

### BE

- [ ] WGL-EDU-S201 수강/진도 API: Enrollment(코스 동시 수강 허용 D20), LessonProgress(단계별 완료·포인트지급 플래그, Dog 기준), 순차 잠금 판정은 `domain/education` 순수 로직 + 단위 테스트 (의존: S103 / 산출: `/v1/enrollments`, `/v1/lessons/:id/progress` + 테스트)
- [ ] WGL-EDU-S202 시청완료 기록 API: 클라이언트 95% 판정 결과 수신(D19), 서버측 시청 시간 sanity check, 최초 1회 판별 후 `lesson.step.completed(video)` 이벤트 발행 (의존: S201 / 산출: 시청완료 엔드포인트 + 이벤트)
- [ ] WGL-EDU-S203 실습 자가체크 API: 레슨별 체크리스트 조회, 자가 체크 성공 처리(D2), `lesson.step.completed(practice)` 발행 (의존: S201 / 산출: 자가체크 엔드포인트)
- [ ] WGL-EDU-S204 `lesson-evaluator` 워커: `lesson.step.completed` 소비 → 진도 갱신·레슨 완료(3단계 AND) 판정 → `lesson.completed` 발행 (의존: S007, S202 / 산출: 워커 + 통합 테스트)

### WEB

- [ ] WGL-EDU-S210 커리큘럼 홈: **듀오링고식 경로 UI** — 유닛/레슨 노드, 잠금/진행중/완료 상태, 현재 위치 스크롤 (의존: S201 / 산출: 교육 탭 홈)
- [ ] WGL-EDU-S211 레슨 플레이어: **YouTube IFrame Player API** 임베드, 진도 폴링으로 95% 시청 판정(배속 허용), 완료 시 서버 보고 + videoId 노출 최소화 (의존: S202 / 산출: 플레이어 컴포넌트)
- [ ] WGL-EDU-S212 자가체크 UI: 체크리스트 표시 → 전체 체크 시 실습 성공 처리 (의존: S203 / 산출: 자가체크 화면)
- [ ] WGL-EDU-S213 코스 탐색/상세: 전체 코스 목록, 코스 상세(유닛/레슨 구성), 수강 신청/동시 수강 (의존: S201 / 산출: 코스 목록·상세 화면)

### ADM

- [ ] WGL-EDU-S220 실습 체크리스트 에디터: 레슨별 체크 항목 편집 (의존: S120 / 산출: CMS 확장)
- [ ] WGL-EDU-S221 퀴즈 에디터: 4지선다 3~5문항(D18) 작성/미리보기, 문항 수·통과 기준은 정책값 참조 표기 (의존: S120 / 산출: 퀴즈 편집 화면)

### QA/OPS

- [ ] WGL-EDU-S230 IFrame 진도 판정 크로스 검증: iOS Safari / Android Chrome / WebView, 백그라운드 전환·탭 이탈·배속 케이스 (의존: S211 / 산출: 판정 케이스 매트릭스 + 이슈 목록)

### DoD

- 파일럿 코스에서 영상 시청(95%) → 자가체크까지 진행되고 다음 레슨 잠금 해제 로직 동작(퀴즈는 S4에서 합류)
- 순차 잠금·동시 수강 단위 테스트 85%+

---

## Sprint S4 — 퀴즈 + 포인트 적립/유효기간 배치 + 정책설정 (Week 7–8)

### BE

- [ ] WGL-EDU-S301 퀴즈 API: 출제(레슨별 문항)/제출/채점/통과 판정(통과 기준은 정책값), 재시도 무제한·포인트는 최초 통과 1회(D18), 통과 시 다음 레슨 해제 (의존: S201, S221 / 산출: `/v1/lessons/:id/quiz/*`)
- [ ] WGL-EDU-S302 포인트 적립: P_watch/P_practice/P_quiz 각 최초 1회(D7) + 유닛/코스 완주 보너스(D20), `point-settler` 큐 경유, 단일 트랜잭션(SELECT FOR UPDATE → PointLedger insert → PointWallet update) (의존: S204, S301 / 산출: 적립 파이프라인 + 통합 테스트)
- [ ] WGL-EDU-S303 원장 유효기간: 적립 건 `expiresAt`(적립+1년, D21) 기록, 차감 시 **선입선출 소진** 로직 (의존: S302 / 산출: FIFO 차감 함수 + 동시성 테스트)
- [ ] WGL-EDU-S304 소멸 배치 워커(`point-expirer`): 만료 도래분 소멸 차감 기록 생성 + 소멸 30일/7일 전 대상 추출(알림 발송은 S7 푸시 합류 전까지 인앱) (의존: S303 / 산출: 배치 워커 + repeat 잡)
- [ ] WGL-EDU-S305 PolicyConfig API(D16): 정책값 key-value 조회/변경 + 변경 이력 AuditLog + 서버 캐시 무효화. 대상 — 포인트 단가 3종, 완주 보너스, 충전 패키지(웹/IAP), 문의권 가격, 정산 비율, 퀴즈 문항 수·통과 기준, 일일 적립 상한 (의존: S003 / 산출: AAPI 정책 API + MAPI 정책 리더)
- [ ] WGL-EDU-S306 일일 적립 상한 적용(어뷰징 완화, 스펙 §9): 적립 시 상한 검사, 초과 시 적립 스킵 기록 (의존: S302, S305 / 산출: 상한 로직 + 테스트)

### WEB

- [ ] WGL-EDU-S310 퀴즈 UI: 문항 풀이/채점 결과/재시도, 통과 시 다음 레슨 해제 연출 (의존: S301 / 산출: 퀴즈 화면)
- [ ] WGL-EDU-S311 포인트 적립 피드백: 단계별 적립 팝업(낙관적 표시) + 완주 보너스 연출 (의존: S302 / 산출: 적립 UX 컴포넌트)
- [ ] WGL-EDU-S312 포인트 지갑/내역: 잔액, 적립/사용 내역, **소멸 예정 포인트 표시**(D21) (의존: S303 / 산출: 지갑 화면)
- [ ] WGL-EDU-S313 홈 위젯: 데일리 목표 진행률 + 이어서 학습 CTA (의존: S105, S201 / 산출: 홈 화면 v1)

### ADM

- [ ] WGL-EDU-S320 정책설정 화면(D16): 전 정책값 편집 + 변경 이력 뷰, O-01 확정 초기값 입력 (의존: S305 / 산출: 정책설정 화면)
- [ ] WGL-EDU-S321 회원 상세 개편: 강아지별 수강/진도/포인트(소멸 예정 포함) 조회 (의존: S201, S303 / 산출: 회원 상세 화면 v2)

### QA/OPS

- [ ] WGL-EDU-S330 레슨 루프 E2E(Supertest): 시청 → 자가체크 → 퀴즈 → 포인트 3회 적립 + 재수행 시 중복 적립 0 (의존: S302 / 산출: E2E 스위트)
- [ ] WGL-EDU-S331 포인트 동시성/FIFO 테스트: 동시 적립·차감 레이스, 만료 경계(365일) 케이스 (의존: S303, S304 / 산출: 동시성 테스트 리포트)

### DoD

- 레슨 1개 완료 시 포인트가 정확히 3회 적립되고 완주 보너스 지급
- 정책값 변경이 재배포 없이 즉시 반영 (하드코딩 0)
- FIFO 소멸 배치가 스테이징에서 정상 순환

---

## Sprint S5 — PortOne 충전 + 포인트샵 개편 (Week 9–10, 추석 연휴 버퍼)

> 09-24~26 추석 연휴 — 실가동 8일 기준으로 범위 산정. O-01(정책 초기값)·O-02(환불 정책) 확정 필요.

### BE

- [ ] WGL-EDU-S401 충전 패키지 API: PolicyConfig의 웹 채널 패키지 조회(D15 — IAP 가격은 Phase 5), PointRecharge 생성·PortOne 사전등록/금액 검증 (의존: S305 / 산출: `/v1/recharges/*`)
- [ ] WGL-EDU-S402 PortOne webhook: 서명 검증·멱등성 처리 → 충전 완료 시 원장 기록(`recharge` 원천, expiresAt 정책 확인) (의존: S401 / 산출: webhook 핸들러 + 멱등 테스트)
- [ ] WGL-EDU-S403 충전분/적립분 구분 원장·잔액: 원천별 잔액 집계(환불·정산·IAP 대응 대비), 사용 시 소진 우선순위 규칙 확정 반영 (의존: S303, S402 / 산출: 원장 구분 로직 + 테스트)
- [ ] WGL-EDU-S404 디지털 상품(D11): 상품 유형 확장 — 훈련사 문의권(보유 수량), 프리미엄 콘텐츠 잠금해제(코스 접근 권한). 구매 시 즉시 지급, 배송 없음 (의존: S302 / 산출: 디지털 상품 구매 API)
- [ ] WGL-EDU-S405 실물 상품 회귀·정비: 기존 카탈로그/장바구니/주문/`order-fulfillment` 흐름 신규 스키마에서 회귀 검증, 필요 개편 (의존: S005 / 산출: 회귀 테스트 통과)

### WEB

- [ ] WGL-EDU-S410 충전 화면: 패키지 목록 + PortOne V2 SDK 결제(웹 채널 전용) — **앱 WebView 진입 시 결제창 미노출 분기 훅 마련**(D15) (의존: S401 / 산출: 충전 플로우)
- [ ] WGL-EDU-S411 포인트샵 개편 UI: 실물/디지털 탭, 상품 상세, 포인트 결제, 문의권·프리미엄 구매 (의존: S404, S405 / 산출: 포인트샵 화면 v2)
- [ ] WGL-EDU-S412 구매/주문 내역: 실물 배송 조회 + 디지털 사용 내역(문의권 잔여 등) (의존: S404 / 산출: 내역 화면)

### ADM

- [ ] WGL-EDU-S420 충전/PG 운영 화면: 충전 내역, PG 거래 대사, 수동 조정(AuditLog 필수) (의존: S402 / 산출: 충전 운영 화면)
- [ ] WGL-EDU-S421 상품 CMS 확장: 디지털 상품 유형 등록/관리 (의존: S404 / 산출: 상품 CMS v2)

### QA/OPS

- [ ] WGL-EDU-S430 PortOne 테스트 결제 시나리오: 카드/간편결제 + 실패/중단/재시도 + webhook 중복 멱등성 (의존: S402, S410 / 산출: 결제 QA 리포트)

### DoD

- 충전 → 잔액 반영 → 디지털/실물 구매까지 완결, 결제 성공률 계측 시작
- 충전분/적립분이 원장에서 구분 조회됨

---

## Sprint S6 — 훈련사 Q&A + TRAINER 롤 + 정산 + 배지/일상기록 (Week 11–12)

> O-03(배정 방식) 확정 필요. 미확정 시 관리자 수동 배정으로 구현하고 자동 배정은 백로그.

### BE

- [ ] WGL-EDU-S501 Inquiry 모듈: 문의 영상 presigned 업로드(≤N분) + `video-postprocess` 큐 처리, 질문 등록 시 문의권 차감(단일 트랜잭션) (의존: S404 / 산출: `/v1/inquiries/*` + 업로드 파이프라인)
- [ ] WGL-EDU-S502 배정/답변 API: 배정(O-03 반영), 훈련사 답변(텍스트/영상), 상태 머신(접수→배정→답변→평가/환불) (의존: S501 / 산출: 배정·답변 API)
- [ ] WGL-EDU-S503 `inquiry-sla-watcher` 워커(신규): 48h SLA 감시 → 초과 시 자동 환불(문의권/포인트 복구) + 알림 (의존: S502 / 산출: SLA 워커 + 테스트)
- [ ] WGL-EDU-S504 Trainer/정산: Trainer 프로필(분야 태그), TrainerSettlement 월 정산 집계(차감 포인트 × 정산 비율 — 정책값), 지급 내역 (의존: S502, S305 / 산출: 정산 배치 + 조회 API)
- [ ] WGL-EDU-S505 배지/학년: `domain/dogs/grade.ts`를 **교육 이수도→학년**으로 교체(D8), 코스/유닛 완주 배지 지급(`lesson-evaluator` 연계) (의존: S204, S302 / 산출: grade v2 + Badge 지급 로직 + 테스트)
- [ ] WGL-EDU-S506 일상기록 API(D1, 보조): DailyEntry 정비 — 접종·산책유무(단순 체크)·사진·자유기록, 캘린더 월간 조회, **포인트 미연동** (의존: S003 / 산출: `/v1/daily-entries/*`)

### WEB

- [ ] WGL-EDU-S510 Q&A 화면: 영상 업로드(file input capture) + 질문 작성 + 문의권 차감 안내, 문의 목록/답변 확인, 별점 평가 (의존: S501, S502 / 산출: Q&A 플로우)
- [ ] WGL-EDU-S511 배지/학년 화면: 강아지 프로필에 학년·배지 컬렉션 표시 (의존: S505 / 산출: 프로필 화면 v2)
- [ ] WGL-EDU-S512 일상기록 캘린더: 월간 뷰 + 기록 추가(사진 업로드 포함) (의존: S506 / 산출: 기록 탭)

### ADM

- [ ] WGL-EDU-S520 **TRAINER 롤 RBAC**(D13): Admin 계정에 롤 추가, TRAINER는 배정 Q&A·본인 정산만 접근 가능한 메뉴/가드 (의존: S502 / 산출: RBAC + 권한 테스트)
- [ ] WGL-EDU-S521 훈련사 답변 화면: 배정 목록 + SLA 남은 시간 표시, 텍스트/영상 답변 작성 (의존: S520 / 산출: 훈련사용 화면)
- [ ] WGL-EDU-S522 훈련사 관리: 계정 생성/분야 태그, Q&A 배정·모니터링(SLA 대기열) (의존: S502 / 산출: 훈련사 관리 화면)
- [ ] WGL-EDU-S523 정산 화면: 월 정산 내역/지급 처리(관리자) + 본인 정산 조회(TRAINER) (의존: S504, S520 / 산출: 정산 화면)

### QA/OPS

- [ ] WGL-EDU-S530 Q&A E2E: 업로드→차감→배정→답변→평가 / SLA 초과→자동 환불 두 경로 (의존: S503 / 산출: E2E 스위트)

### DoD

- 문의권 구매 → 질문 → 훈련사 답변 → 평가 완결, SLA 초과 시 자동 환불 확인
- TRAINER 계정 권한 격리 검증 (admin 메뉴 접근 불가)
- 코스 완주 시 배지·학년 갱신

---

## Sprint S7 — Android shell + 푸시(FCM) + QA/부하/출시 (Week 13–14)

> 콘텐츠 트랙 합류 지점: 6~7코스 약 100레슨(D22) 등록·검수 완료가 출시 전제.

### SHELL

- [ ] WGL-EDU-S601 `apps/android-shell`(Kotlin): WebView 래퍼 — 쿠키/세션 유지, 파일 업로드(카메라 capture), 뒤로가기/새로고침 처리 (의존: S031 / 산출: 앱 골격 + 스테이징 접속)
- [ ] WGL-EDU-S602 FCM + 딥링크: 푸시 수신 → `packages/deeplinks` 라우트로 WebView 이동, 알림 권한 요청 (의존: S601, S610 / 산출: 푸시→화면 이동 동작)
- [ ] WGL-EDU-S603 충전 채널 분기(D15): 앱 WebView에서 PortOne 결제창·웹 가격 안내 미노출(스티어링 금지), 앱 내 충전은 안내 처리 — IAP 연동은 Phase 5 태스크 (의존: S410, S601 / 산출: 채널 분기 동작 + 정책 체크리스트)
- [ ] WGL-EDU-S604 Play Console 배포: 서명/버전 체계, 내부 테스트 → 비공개 테스트 트랙 업로드, 데이터 보안 양식 (의존: S601~S603 / 산출: 테스트 트랙 링크)

### BE

- [ ] WGL-EDU-S610 FCM 발송 통합: 디바이스 토큰 등록 API + `notification-dispatcher` 실발송, 알림 카테고리 관리 (의존: S007 / 산출: 푸시 발송 파이프라인)
- [ ] WGL-EDU-S611 데일리 목표 리마인드 푸시(D8): 설정 시간대에 목표 미달성 유저 대상 발송(BullMQ repeat) (의존: S105, S610 / 산출: 리마인드 잡)
- [ ] WGL-EDU-S612 포인트 소멸 예정 알림(D21): 소멸 30일/7일 전 푸시+인앱 (의존: S304, S610 / 산출: 소멸 알림 잡)
- [ ] WGL-EDU-S613 알림 목록/읽음 API + 알림 설정(카테고리 on/off) (의존: S610 / 산출: 알림 API)

### WEB

- [ ] WGL-EDU-S620 알림함/설정/마이페이지 마무리: 알림 목록·읽음, 알림 설정, 계정 관리(탈퇴 포함) (의존: S613 / 산출: 마이 탭 완성)
- [ ] WGL-EDU-S621 모바일웹 폴리시: PWA 매니페스트, 안전영역(safe-area), 스켈레톤 로딩, 오프라인 안내, WebView UA 대응 (의존: S601 / 산출: Lighthouse 모바일 90+)

### QA/OPS

- [ ] WGL-EDU-S630 E2E 회귀 시나리오: 가입 → 온보딩 → 레슨 루프 → 포인트 적립 → 충전 → 포인트샵 → Q&A → 알림 수신 (의존: S530, S602 / 산출: 회귀 시나리오 통과 리포트)
- [ ] WGL-EDU-S631 부하 테스트(k6): **레슨 완료 동시 200건** — `infra/k6/lesson-completion.js` 신규(구 walk-completion.js 대체·삭제), 포인트 적립 정합성 검증 포함 (의존: S302 / 산출: k6 스크립트 + 결과 리포트)
- [ ] WGL-EDU-S632 안정화: Sentry 상위 에러 0, WebView 크래시/화이트스크린 대응 (산출: 이슈 제로 리포트)
- [ ] WGL-EDU-S633 심사·법무 대응: 개인정보처리방침·이용약관 게시, 통신판매업 신고 확인, 스토어 메타데이터/스크린샷 (산출: 심사 제출 패키지)
- [ ] WGL-EDU-S634 콘텐츠 최종 검수: 100레슨 게시 상태·퀴즈/체크리스트 데이터 무결성 점검(CMS 리포트) (의존: S130 트랙 / 산출: 콘텐츠 검수 체크리스트)

### DoD

- Play 비공개 테스트 트랙에 내부 테스터 20명+ 설치, 푸시·딥링크 정상
- E2E 회귀 성공률 95%+, k6 p95 500ms 이하(레슨 완료 API)
- 콘텐츠 100레슨 검수 완료

---

## Phase 5 이후 (본 문서 범위 밖 — 로드맵 §6 참조)

- iOS shell(WKWebView + APNs + 네이티브 탭바·알림설정, 심사 4.2 대응), **IAP 충전(채널별 가격 차등 D15)**, 프로덕션 전환·런북·온콜은 `개발계획_01_로드맵.md` Phase 5에서 별도 채번(`WGL-EDU-S7xx`) 예정.

---

## 공통 스프린트 리추얼

| 리추얼 | 주기 | 목적 |
|---|---|---|
| 스프린트 플래닝 | 격주 월 10:00 | 범위 확정 |
| 데일리 스탠드업 | 매일 10분 | 블로커 공유 |
| 스프린트 리뷰 | 격주 금 15:00 | 데모 + 의사결정 |
| 회고 | 격주 금 16:00 | 개선 액션 |
| 콘텐츠 싱크 | 주 1회 | 제작 진척(주 8~10레슨) ↔ CMS 등록 상태 점검 |
| 아키텍처 리뷰 | 월 1회 | 기술부채/결정 기록(ADR) |

---

## MVP 품질 게이트 (Phase 4 출시 전)

- [ ] **백엔드**: p95 응답 < 500ms(홈/커리큘럼/레슨 완료), 5xx율 < 0.1%
- [ ] **웹/셸**: WebView 초기 로드 < 3s(중급 Android 기준), 크래시 프리 세션 > 99%
- [ ] **포인트**: 레슨 루프 100회 샘플 적립 정합성 100%, FIFO 소멸 경계 테스트 통과
- [ ] **결제**: PortOne 성공/실패/중복 webhook 시나리오 자동 검증
- [ ] **IAP 정책**: 앱 내 웹 가격 안내·PortOne 노출 0건 (D15 체크리스트)
- [ ] **보안**: Trivy 고위험 취약점 0, TRAINER/ADMIN 권한 격리 테스트 통과, backup 스키마 접근 차단 확인
- [ ] **법무**: 이용약관 v1, 개인정보처리방침 v1 게시
- [ ] **운영**: 런북(결제/DB/푸시/포인트) 작성, 정책값 변경 절차 문서화
- [ ] **콘텐츠**: 6~7코스 약 100레슨 게시·검수 완료

---

## 백로그 (스프린트 비배정)

- Q&A 분야 태그 자동 배정 (O-03이 수동으로 확정된 경우)
- 이상 패턴 모니터링 대시보드 (자가체크 어뷰징 탐지)
- 관리자 대시보드 KPI 차트(Recharts), 엑셀 리포트
- Storybook(mobile-web/admin 공용), Playwright 스모크 세트 확대
- OpenAPI → Redocly 퍼블릭 문서
- YouTube → S3+HLS 전환 설계 문서 (Phase 6 대비)

---

## 참고

- 실행 이슈는 GitHub Projects의 "Waggle EDU MVP" 보드에 매핑. 라벨: `area:be/web/adm/shell/ops`, `prio:P0/P1/P2`, `type:feat/bug/chore`.
- 각 태스크 PR에는 `#WGL-EDU-Sxxx` 참조 필수.
- 의존성이 높은 태스크(S001→S002→S003, S120→S130)는 스프린트 시작일에 먼저 착수.
