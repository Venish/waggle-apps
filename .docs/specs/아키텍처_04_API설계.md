# Waggle 시스템 아키텍처 설계 (04) — API 및 모듈 구조

작성일: 2026-07-22
버전: **v1.0 (교육앱 피벗 전면 개정)**
단일 진실 원천: `기획_교육앱_스펙정의.md` (결정사항 D1~D24)

---

## 0. 개정 요약 (v0.1 → v1.0)

| 구분 | 내용 |
|---|---|
| **제거** | `walks` 모듈 전체(GPS 업로드·경로·산책 사진), `missions` 모듈 전체(미션 목록/claim), 네이버지도 연동, HLS 강의 스트리밍(`/lessons/:id/stream`), `mission-evaluator` 큐 |
| **신규 (MAPI)** | `onboarding`(설문·룰 매칭·레벨테스트), `curriculum`(코스/유닛/레슨·수강), `lesson`(시청완료·실습 자가체크·퀴즈), `recharge`(포인트 충전: PortOne/IAP), `inquiry`(훈련사 비동기 영상 Q&A), `daily-goal`(데일리 목표), `dailylog`(일상기록, 포인트 미연동) |
| **개정 (MAPI)** | `points`(유효기간 1년·선입선출·소멸 예정 조회), `shop`(디지털 상품: 문의권·프리미엄 잠금해제), `badges`(이수도 기반 학년), `home` BFF(교육 중심 재구성) |
| **신규 (AAPI)** | 커리큘럼 CMS(Course/Unit/Lesson/퀴즈/실습체크리스트/게시·버전), 매칭 운영(설문·태그·가중치), 정책 설정(`PolicyConfig`), 훈련사 관리(계정/배정/정산), **TRAINER 롤 전용 API**(RBAC) |
| **큐 개편** | `lesson-evaluator`(구 mission-evaluator), `inquiry-sla-watcher`(신규, 48h 자동환불), `point-expirer`(신규, 포인트 소멸 배치), `video-postprocess`(Q&A 문의 영상 전용으로 축소) |
| **결제** | 웹(mobile-web)은 PortOne, 앱(shell 배포판)은 IAP — 채널별 충전 가격 차등(D15), 앱 내 웹 가격 스티어링 금지 |
| **유지** | 응답 래퍼 `{ data, meta?, error? }`, 에러 규약, JWT(Access 15분/Refresh 30일), 커서 페이지네이션, Idempotency-Key, 포인트 단일 트랜잭션 원칙, 포인트샵 실물 주문/배송 |

클라이언트 채널 변경(D14): RN 앱 → **mobile-web(Next.js) + android-shell/ios-shell(WebView)**. MAPI는 모바일웹과 shell 공용이며, 충전 채널 분기를 위해 클라이언트가 `X-Client-Channel` 헤더를 전송한다(§3.8).

---

## 1. 공통 API 규약

### 1.1 기본 원칙

| 항목 | 규칙 |
|---|---|
| 스타일 | REST + JSON. 일부 복잡 화면은 **BFF 엔드포인트**(`/v1/home/summary` 등) |
| URL | `https://api.waggle.app/v1/...` (MAPI), `https://admin-api.waggle.app/v1/...` (AAPI) |
| 버저닝 | URL path 기반 `/v1`, `/v2` |
| 요청 ID | 모든 응답 헤더에 `X-Request-Id` (추적용) |
| 시간 | ISO 8601 UTC (`2026-07-22T10:20:30Z`) |
| 페이지네이션 | **커서 기반** 기본. `?cursor=<id>&limit=20`. 일부 관리자용만 offset |
| Idempotency | 결제/포인트 차감/문의 생성 엔드포인트는 `Idempotency-Key` 헤더 필수 |
| 응답 래핑 | 모든 응답은 `{ data, meta?, error? }` 래퍼 (ResponseInterceptor). 목록은 `meta.nextCursor` 포함 |

```json
// 목록 응답 예
{
  "data": [ { "id": "...", "title": "퍼피 기본예절" } ],
  "meta": { "nextCursor": "01J...", "limit": 20 }
}
```

### 1.2 표준 에러 포맷

에러 시 `error` 필드에 RFC 7807 유사 구조를 담는다. HttpExceptionFilter가 변환.

```json
{
  "data": null,
  "error": {
    "type": "https://waggle.app/errors/domain",
    "title": "Insufficient points",
    "status": 422,
    "code": "DOMAIN_POINT_INSUFFICIENT",
    "detail": "잔액 500P, 필요 3000P",
    "errors": [],
    "traceId": "01HXYZ..."
  }
}
```

에러 코드는 `@waggle/dto/errors.ts`에 상수로 관리. 카테고리:

- `AUTH_*` — 인증/인가 (`AUTH_TRAINER_FORBIDDEN` 등 롤 위반 포함)
- `VALIDATION_*` — 입력 검증
- `RESOURCE_*` — 존재/권한
- `DOMAIN_*` — 도메인 규칙 위반 (포인트 부족, 레슨 잠김 `DOMAIN_LESSON_LOCKED`, 퀴즈 미통과, 중복 지급 시도 등)
- `EXTERNAL_*` — 외부 서비스 실패 (PortOne, IAP 영수증 검증, YouTube, 푸시)
- `RATE_LIMIT`

### 1.3 인증

- 보호자(USER): `Authorization: Bearer <accessJwt>` + `X-Device-Id`(shell 설치 시) + `X-Client-Channel: web | android | ios`
- 관리자/훈련사: `Authorization: Bearer <accessJwt>` (httpOnly 쿠키 병행 가능). JWT payload에 `role: ADMIN | TRAINER`
- 토큰 수명: **Access 15분 / Refresh 30일** (기존 유지)
- 패스워드 해시: Argon2id (기존 유지)

### 1.4 RBAC (AAPI)

| 롤 | 접근 범위 |
|---|---|
| `ADMIN` | AAPI 전체 |
| `TRAINER` | `/v1/trainer/*` 만 (본인 배정 문의·본인 정산). 그 외 전부 403 `AUTH_TRAINER_FORBIDDEN` |

구현: `@Roles('ADMIN')` / `@Roles('TRAINER')` 데코레이터 + `RolesGuard`. 컨트롤러 기본값은 `ADMIN`(deny-by-default), TRAINER 허용 라우트만 명시 오픈.

### 1.5 Rate Limiting

| 엔드포인트 계열 | 기준 | 한도 |
|---|---|---|
| `/auth/*` | IP | 10/분 |
| 로그인 실패 | 계정 | 5/10분 → 잠금 |
| 일반 조회 | userId | 300/분 |
| 쓰기 | userId | 60/분 |
| 시청완료/실습/퀴즈 제출 | dogId+lessonId | 10/분 (파밍 완화) |
| 결제 webhook | IP 허용목록(PortOne) | — |

---

## 2. MAPI 모듈 구조 (apps/mobile-api)

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── filters/            # HttpExceptionFilter
│   ├── interceptors/       # ResponseInterceptor ({data,meta,error}), Logging
│   ├── guards/             # JwtAuthGuard, RefreshTokenGuard
│   ├── decorators/         # @CurrentUser, @Public
│   └── pipes/              # ZodValidationPipe
├── prisma/                 # PrismaService
├── infra/
│   ├── redis/
│   ├── queue/              # BullMQ enqueue 클라이언트
│   ├── storage/            # S3 presigned URL
│   ├── push/               # FCM (APNs는 FCM 위임)
│   └── payments/           # PortOne 클라이언트 + IAP 영수증 검증(Google/Apple)
└── modules/
    ├── auth/               # 유지 (이메일 + 소셜)
    ├── users/              # 유지
    ├── dogs/               # 유지 (summary는 교육 이수 중심으로 개정)
    ├── devices/            # 유지 (shell 푸시 토큰)
    ├── onboarding/         # ★ 설문 조회/제출, 커리큘럼 추천, 레벨테스트
    ├── curriculum/         # ★ 코스/유닛/레슨 조회, 수강(Enrollment), 진도
    ├── lesson/             # ★ 시청완료 보고, 실습 자가체크, 퀴즈
    ├── points/             # 개정 (유효기간/소멸 예정)
    ├── recharge/           # ★ 충전 패키지, PortOne 결제/webhook, IAP 검증
    ├── inquiry/            # ★ 훈련사 비동기 영상 Q&A
    ├── daily-goal/         # ★ 데일리 목표 설정/달성
    ├── badges/             # 개정 (이수도 학년 + 배지)
    ├── dailylog/           # ★ 일상기록 (구 notebook 대체, 포인트 미연동)
    ├── shop/               # 유지 + 디지털 상품
    │   ├── catalog/  cart/  orders/  addresses/
    ├── notifications/      # 유지
    ├── home/               # BFF 개정
    └── uploads/            # presigned URL (kind 개정)
```

제거: `walks/`, `missions/`, `health-records/`(dailylog에 접종 기록으로 통합), `infra/maps/`.

---

## 3. MAPI 주요 엔드포인트 (v1)

### 3.1 Auth (유지)

| Method | Path | 설명 |
|---|---|---|
| POST | `/v1/auth/signup` | 이메일 회원가입 |
| POST | `/v1/auth/login` | 이메일 로그인 |
| POST | `/v1/auth/social/:provider/token` | 카카오/네이버/구글/애플 토큰 교환 |
| POST | `/v1/auth/refresh` | Refresh → Access 재발급 |
| POST | `/v1/auth/logout` | Refresh Token 폐기 |
| POST | `/v1/auth/password/reset-request` | 재설정 메일 발송 |
| POST | `/v1/auth/password/reset` | 재설정 수행 |
| POST | `/v1/auth/devices` | shell 푸시 토큰 등록/갱신 |
| DELETE | `/v1/auth/devices/:id` | 기기 해제 |
| DELETE | `/v1/auth/account` | 회원 탈퇴 (30일 유예, soft delete) |

소셜 로그인 흐름 유지(소셜 토큰 서버 보관 금지 — 프로필 조회 후 폐기).

### 3.2 Users / Dogs (유지·일부 개정)

| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/me` | 내 프로필 |
| PATCH | `/v1/me` | 닉네임/푸시 동의 변경 |
| PATCH | `/v1/me/notifications/settings` | 카테고리별 on/off (데일리 리마인드, 소멸 예정, Q&A 답변 등) |
| GET | `/v1/dogs` | 내 반려견 목록 |
| POST | `/v1/dogs` | 반려견 등록 (이름·견종·생년월·성별·중성화·체중) → 월령 태그(puppy/adolescent/adult/senior) 자동 부여 |
| GET | `/v1/dogs/:id` | 상세 |
| PATCH | `/v1/dogs/:id` | 수정 |
| DELETE | `/v1/dogs/:id` | soft delete |
| GET | `/v1/dogs/:id/summary` | **교육 이수율, 현재 학년, 획득 배지 수, 수강 중 코스** (산책거리 제거) |
| GET | `/v1/breeds?q=` | 견종 검색 |

진도·수강·배지는 모두 **Dog 기준**(한 계정 다견 지원, D24 변경 사항).

### 3.3 Onboarding ★

| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/onboarding/survey` | 설문 문항+선택지 조회 (게시 버전, D17: 전부 객관식·비분기·단독 질문) |
| POST | `/v1/onboarding/survey/answers` | 답변 제출 `{ dogId, answers: [{questionId, optionIds[]}] }` (복수 선택 문항 지원) |
| GET | `/v1/onboarding/recommendations?dogId=` | **룰 기반 태그 매칭** 추천 코스 목록 (점수순) |
| GET | `/v1/onboarding/level-test?courseId=` | 레벨테스트 문항 조회 (4지선다, 선택 사항) |
| POST | `/v1/onboarding/level-test/attempts` | 제출 `{ dogId, courseId, answers[] }` → 통과 레벨 이하 레슨 일괄 이수 처리 |

추천 로직(D9): 답변 태그 + 프로필 자동 태그(월령/견종/환경) ↔ `CourseTag` 가중치 매칭 점수 계산 — `@waggle/domain/matching`. 태그·가중치는 AAPI에서 운영 조정.

추천 응답 예:

```json
{
  "data": [
    { "courseId": "01J...", "title": "분리불안 개선", "score": 87,
      "matchedTags": ["prob_sep", "env_apt", "puppy"] }
  ]
}
```

레벨테스트 결과는 `LevelTestAttempt`로 기록하고, 이수 처리된 레슨은 **포인트 미지급**(적립은 실제 수행 시에만).

### 3.4 Curriculum ★

| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/curriculum/courses?tag=&cursor=` | 게시된 코스 목록 (수강 여부/진도 포함) |
| GET | `/v1/curriculum/courses/:id` | 코스 상세 — 유닛/레슨 트리 + 레슨별 잠금 상태 |
| POST | `/v1/curriculum/courses/:id/enroll` | 수강 등록 `{ dogId }` → `Enrollment` 생성. **동시 수강 허용**(D20), 동일 (dogId, courseId) 중복만 409 |
| DELETE | `/v1/curriculum/enrollments/:id` | 수강 중단 (진도 보존) |
| GET | `/v1/curriculum/enrollments?dogId=` | 수강 중/완료 코스 + 진도율 |
| GET | `/v1/curriculum/lessons/:id` | 레슨 상세 — YouTube videoId, 실습 체크리스트, 퀴즈 메타(문항 수·통과 기준), 내 단계별 진행 상태 |

잠금 규칙(D5): **코스 내 순차 잠금** — 직전 레슨 완료(시청 AND 실습 AND 퀴즈통과) 시 다음 레슨 해제. 코스 간에는 잠금 없음. 잠긴 레슨 접근 시 403 `DOMAIN_LESSON_LOCKED`.

### 3.5 Lesson (수강 루프) ★

| Method | Path | 설명 |
|---|---|---|
| POST | `/v1/lessons/:id/watch-complete` | 시청완료 보고 `{ dogId, watchedRatio, playbackRate, watchedSeconds }` |
| POST | `/v1/lessons/:id/practice` | 실습 자가체크 제출 `{ dogId, checklist: [{itemId, checked}] }` |
| GET | `/v1/lessons/:id/quiz` | 퀴즈 조회 — 4지선다 3~5문항(D18), **정답 미포함** |
| POST | `/v1/lessons/:id/quiz/attempts` | 퀴즈 제출 `{ dogId, answers: [{questionId, optionIndex}] }` |
| GET | `/v1/lessons/:id/progress?dogId=` | 단계별 진행 상태 (시청/실습/퀴즈 각 완료 여부·포인트 지급 여부) |

**시청완료 판정(D19)**: 클라이언트가 YouTube IFrame Player API 진도 이벤트로 **95% 이상 시청** 판정(배속 허용) 후 보고. 서버는 `watchedRatio >= 0.95` 검증 + 레슨 오픈 시각 대비 최소 경과시간(영상 길이/최대 배속) 등 기본 무결성 확인 후 기록.

**퀴즈**: 통과 기준은 `PolicyConfig`(예: 80%, D16·D18). 재시도 무제한. 응답:

```json
{
  "data": {
    "attemptId": "01J...", "score": 4, "total": 5, "passed": true,
    "unlockedLessonId": "01J...",
    "pointGranted": { "amount": 50, "reason": "quiz_passed" }
  }
}
```

**포인트 지급(D7)**: 레슨×강아지당 시청/실습/퀴즈 **각 최초 1회만**. `LessonProgress`의 지급 플래그로 멱등 보장. 완료 이벤트는 `lesson-evaluator`·`point-settler` 큐로 발행(§7). 유닛/코스 마지막 레슨 완료 시 완주 보너스 자동 지급(D20).

### 3.6 Points (개정)

| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/points/wallet` | 잔액 + 이번 달 적립/사용 + **30일 내 소멸 예정 포인트** |
| GET | `/v1/points/ledger?type=&cursor=` | 원장 내역. `type`: `earn_education` / `earn_bonus` / `recharge` / `spend_shop` / `spend_inquiry` / `refund` / `expire` |
| GET | `/v1/points/expiring?within=30d` | 소멸 예정 상세 (적립 건별 `expiresAt`, 잔여량) |

- **유효기간(D21)**: 적립 건마다 `expiresAt = 적립일 + 1년`. 차감은 **선입선출**(오래된 적립분부터 소진). 소멸 30일/7일 전 푸시(§7 `point-expirer` → `notification-dispatcher`).
- 적립/차감은 단일 트랜잭션(SELECT FOR UPDATE → PointLedger insert → PointWallet update) 원칙 유지, `point-settler` 큐 경유.
- 충전분/적립분 구분 원장 관리(환불·IAP 정산 대비).

### 3.7 Recharge (포인트 충전) ★

| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/recharge/packages` | 충전 패키지 목록 — **`X-Client-Channel`에 따라 해당 채널 가격만 반환**(D15) |
| POST | `/v1/recharge/orders` | 충전 주문 생성 `{ packageId }` + `Idempotency-Key` → 웹: `{ rechargeId, portOnePayload }` / 앱: `{ rechargeId, storeProductId }` |
| POST | `/v1/recharge/webhook/portone` | PortOne webhook (Public, HMAC 서명 검증) → 검증 후 포인트 지급 |
| POST | `/v1/recharge/orders/:id/iap-receipt` | IAP 영수증 제출 `{ platform, receipt }` → 서버가 Google/Apple 검증 API 확인 후 포인트 지급 |
| GET | `/v1/recharge/orders?cursor=` | 내 충전 내역 |

- 채널별 가격 차등(D15): 예. 웹 10,000원=10,000P / IAP 12,000원=10,000P. 가격표는 `PolicyConfig`에서 운영.
- **앱 내 스티어링 금지**: 앱 채널 응답에는 웹 가격·웹 결제 링크를 절대 포함하지 않는다(스토어 정책, §8.1).
- 포인트 지급은 결제 검증 성공 시에만 `point-settler` `recharge` 잡으로 처리. webhook/영수증 중복 수신은 `payment_event_log`로 멱등 처리.

### 3.8 Inquiry (훈련사 비동기 영상 Q&A) ★

| Method | Path | 설명 |
|---|---|---|
| POST | `/v1/inquiries/upload-url` | 문의 영상 presigned PUT URL 발급 `{ contentType, durationS }` (길이 ≤ N분 제한) |
| POST | `/v1/inquiries` | 문의 생성 `{ dogId, videoKey, question, categoryTag? }` + `Idempotency-Key` → **문의권 포인트 즉시 차감**(단일 트랜잭션) |
| GET | `/v1/inquiries?cursor=` | 내 문의 목록 (상태: `PENDING`/`ASSIGNED`/`ANSWERED`/`REFUNDED`) |
| GET | `/v1/inquiries/:id` | 상세 — 질문/영상, 훈련사 답변(텍스트·답변 영상 URL), SLA 기한 |
| POST | `/v1/inquiries/:id/rating` | 답변 평가 (별점, 2차: 훈련사 노출 순위 반영) |

흐름(D4·§4.7):

```
1) presigned URL로 영상 S3 업로드 (mobile-web: <input capture>)
2) POST /v1/inquiries
   - 트랜잭션: 문의권 가격(PolicyConfig) 포인트 차감(FIFO) + Inquiry 생성(PENDING)
   - slaDueAt = createdAt + 48h → inquiry-sla-watcher 큐에 지연 잡 등록
   - video-postprocess 큐: 문의 영상 트랜스코딩/썸네일
3) 배정(관리자 수동 or 태그 자동 — §10 미확정) → ASSIGNED, 훈련사에게 알림
4) 훈련사 답변(AAPI /v1/trainer/*) → ANSWERED, 보호자 푸시
5) 48h 초과 미답변 → inquiry-sla-watcher가 자동 환불(포인트 복구, ledger `refund`) → REFUNDED, 양측 알림
```

포인트 차감 없이 **문의권(디지털 상품) 보유 시 문의권 1매 차감**도 지원 — 생성 시 `{ useTicket: true }`.

### 3.9 Daily Goal / Badges ★

| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/daily-goal?dogId=` | 목표 설정값 + 오늘 달성 현황 |
| PUT | `/v1/daily-goal` | 목표 설정 `{ dogId, lessonsPerDay, reminderTime }` (온보딩 4번 문항 기본값) |
| GET | `/v1/daily-goal/history?dogId=&month=` | 월별 달성 캘린더 |
| GET | `/v1/badges?dogId=` | 배지 컬렉션 (코스/유닛 완주 배지, 획득일) |
| GET | `/v1/dogs/:id/grade` | 강아지 학년 — **교육 이수도 기반**(D8, `@waggle/domain/education/grade`) |

- 목표 달성 판정: `lesson-evaluator`가 `lesson.completed` 이벤트로 갱신.
- 목표 미달 시 `reminderTime`에 리마인드 푸시(`notification-dispatcher` 스케줄).
- 스트릭/리그는 2차 — API 예약 없음.

### 3.10 Dailylog (일상기록, 보조) ★

포인트 **미연동**(D1). GPS/경로 트래킹 없음.

| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/dogs/:id/dailylog?month=YYYY-MM` | 월간 캘린더 요약 (기록 유형 아이콘) |
| GET | `/v1/dogs/:id/dailylog/:date` | 일간 상세 |
| PUT | `/v1/dogs/:id/dailylog/:date` | 기록 upsert `{ walked?: boolean, note?, photoKeys?: [] }` (산책은 유무 체크만) |
| POST | `/v1/dogs/:id/vaccinations` | 접종 기록 추가 → 다음 접종 알림 자동 세팅 |
| GET | `/v1/dogs/:id/vaccinations` | 접종 기록 목록 |
| PATCH | `/v1/dogs/:id/vaccinations/:recId` | 수정 |

### 3.11 Shop (유지 + 디지털 상품)

| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/shop/home` | BFF — 배너 + 카테고리 + 추천 상품 |
| GET | `/v1/shop/products?category=&type=&sort=` | 상품 목록. `type`: `PHYSICAL` / `INQUIRY_TICKET` / `PREMIUM_UNLOCK` |
| GET | `/v1/shop/products/:id` | 상품 상세 |
| GET/POST/PATCH/DELETE | `/v1/shop/cart`, `/v1/shop/cart/items[/:id]` | 장바구니 (실물 상품만) |
| GET/POST | `/v1/shop/addresses` | 배송지 (실물 상품만) |
| POST | `/v1/shop/orders/checkout` | 주문 생성 `{ items, addressId? }` — **전액 포인트 결제**(현금 혼합 없음, 현금은 충전 단계에서만) |
| GET | `/v1/shop/orders?cursor=` / `/v1/shop/orders/:id` | 주문 목록/상세 |
| POST | `/v1/shop/orders/:id/cancel` | 배송 전 취소 (포인트 복구) |
| GET | `/v1/shop/entitlements` | 보유 디지털 상품 — 문의권 잔여 수량, 잠금해제된 프리미엄 콘텐츠 |

- 디지털 상품은 결제 즉시 지급(문의권 수량 증가 / 프리미엄 Enrollment 해제), 실물은 기존 `order-fulfillment` 큐 유지.
- 상품 가격은 **포인트 단일 가격**(D15) — 채널 무관 동일.

### 3.12 Notifications / Uploads / Home

| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/notifications?read=false&cursor=` | 알림 목록 |
| POST | `/v1/notifications/read` | 일괄 읽음 처리 |
| POST | `/v1/uploads/presign` | `{ kind, contentType }` → S3 presigned PUT URL. `kind`: `INQUIRY_VIDEO`, `DAILYLOG_PHOTO`, `DOG_PROFILE`, `USER_AVATAR` |
| GET | `/v1/home/summary?dogId=` | BFF — 오늘의 레슨(이어하기), 데일리 목표 진행, 보유 포인트+소멸 예정, 추천 코스, 미읽음 Q&A 답변 |
| GET | `/v1/health` | 헬스체크 + `minAppVersion`(shell 강제 업데이트 유도) |

---

## 4. AAPI 모듈 구조 (apps/admin-api)

```
src/
├── main.ts
├── app.module.ts
├── common/                 # 필터/인터셉터 + RolesGuard(ADMIN/TRAINER) + IP 화이트리스트
├── prisma/
├── infra/                  # Redis / Storage / PortOne(환불)
└── modules/
    ├── auth/               # 관리자·훈련사 로그인 (role 포함 JWT, 2FA v1.1)
    ├── dashboard/          # KPI (교육 중심 재구성)
    ├── users/  dogs/       # 회원/반려견 관리
    ├── cms/                # ★ Course/Unit/Lesson/퀴즈/실습체크리스트, 게시/버전
    ├── matching/           # ★ 설문 문항·선택지·태그·가중치
    ├── policy/             # ★ PolicyConfig (정책값 key-value + 변경 이력)
    ├── trainers/           # ★ 훈련사 계정·분야태그·배정·정산
    ├── inquiries/          # ★ Q&A 전체 모니터링·수동 배정
    ├── trainer-portal/     # ★ TRAINER 롤 전용 (/v1/trainer/*)
    ├── points/             # 원장 조회, 수동 조정(AuditLog), 충전(PG/IAP) 내역
    ├── shop/               # catalog / orders / shipments (유지)
    ├── content/            # 배너/팝업/공지 (유지)
    ├── notifications/      # 템플릿/일괄 발송 (유지)
    ├── admins/             # 계정 + RBAC (TRAINER 롤 추가)
    ├── audit-log/          # (유지)
    └── reports/            # 집계/다운로드 (유지)
```

제거: `walks/`, `missions/`, 구 `education/`(cms로 재작성), `common-codes/`(policy로 흡수).

---

## 5. AAPI 주요 엔드포인트 (v1)

관리자 **쓰기 액션은 전부 AuditLog 기록**(기존 원칙 유지).

### 5.1 Auth / Dashboard

| Method | Path | 설명 |
|---|---|---|
| POST | `/v1/admin/auth/login` | ADMIN/TRAINER 공용 로그인 → JWT에 `role` |
| POST | `/v1/admin/auth/refresh` / `logout` | |
| POST | `/v1/admin/auth/2fa/setup` / `verify` | (v1.1) |
| GET | `/v1/admin/dashboard/kpi?range=30d` | DAU / 신규가입 / **레슨 완료 수 / 수강 등록 수 / 충전액 / 문의 SLA 준수율** / 주문 GMV |
| GET | `/v1/admin/dashboard/funnel` | 가입 → 반려견 등록 → 설문 완료 → 첫 수강 → 첫 레슨 완료 → 첫 충전 |

### 5.2 커리큘럼 CMS ★

| Method | Path | 설명 |
|---|---|---|
| GET/POST/PATCH/DELETE | `/v1/admin/cms/courses[/:id]` | 코스 CRUD (제목, 설명, 커버, 난이도, 태그) |
| POST | `/v1/admin/cms/courses/:id/publish` | 게시 (버전 스냅샷 생성 — 수강생은 게시 버전 고정) |
| POST | `/v1/admin/cms/courses/:id/unpublish` | 게시 중단 (기존 수강생은 유지) |
| GET | `/v1/admin/cms/courses/:id/versions` | 버전 이력 |
| GET/POST/PATCH/DELETE | `/v1/admin/cms/courses/:courseId/units[/:id]` | 유닛 CRUD + 정렬(`sortOrder`) |
| GET/POST/PATCH/DELETE | `/v1/admin/cms/units/:unitId/lessons[/:id]` | 레슨 CRUD — **YouTube `videoId` 등록**(원본 파일 관리 없음, D6), 영상 길이 |
| PUT | `/v1/admin/cms/lessons/:id/checklist` | 실습 체크리스트 항목 편집 (문구, 순서) |
| PUT | `/v1/admin/cms/lessons/:id/quiz` | 퀴즈 편집 — 4지선다 3~5문항, 문항/선택지/정답 (통과 기준은 정책값) |
| GET/POST/PATCH/DELETE | `/v1/admin/cms/level-tests[/:id]` | 코스별 레벨테스트 문항 |

### 5.3 매칭 운영 ★

| Method | Path | 설명 |
|---|---|---|
| GET/POST/PATCH/DELETE | `/v1/admin/matching/survey/questions[/:id]` | 설문 문항 CRUD (단일/복수 선택 구분, 순서) |
| GET/POST/PATCH/DELETE | `/v1/admin/matching/survey/questions/:qid/options[/:id]` | 선택지 CRUD + 태그 연결 |
| GET/POST/PATCH/DELETE | `/v1/admin/matching/tags[/:id]` | 태그 사전 (exp_*, prob_*, goal_*, env_*, soc_*, 월령 태그) |
| PUT | `/v1/admin/matching/courses/:courseId/tags` | 코스-태그 매핑 + **가중치** 설정 |
| POST | `/v1/admin/matching/simulate` | 가상 답변 세트 → 추천 결과 미리보기 (운영 튜닝용) |
| POST | `/v1/admin/matching/survey/publish` | 설문 버전 게시 |

### 5.4 정책 설정 (PolicyConfig) ★

| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/admin/policies` | 전체 정책값 조회 |
| PUT | `/v1/admin/policies/:key` | 정책값 변경 `{ value, reason }` — **AuditLog + 변경 이력 필수**(D16) |
| GET | `/v1/admin/policies/:key/history` | 변경 이력 |

정책 키 (하드코딩 금지, 전부 여기서 운영):

| key | 의미 |
|---|---|
| `point.watch` / `point.practice` / `point.quiz` | 레슨 단계별 적립 단가 |
| `point.bonus.unit` / `point.bonus.course` | 유닛/코스 완주 보너스 |
| `point.daily_earn_cap` | 일일 적립 상한 (어뷰징 완화) |
| `recharge.packages.web` / `recharge.packages.iap` | 채널별 충전 패키지 가격표 |
| `inquiry.price` / `inquiry.sla_hours` | 문의권 가격 / SLA(기본 48) |
| `settlement.trainer_rate` | 훈련사 정산 비율 (차감 포인트 대비) |
| `quiz.pass_ratio` / `quiz.question_count` | 퀴즈 통과 기준 / 출제 문항 수 |

### 5.5 훈련사 관리 ★

| Method | Path | 설명 |
|---|---|---|
| GET/POST/PATCH | `/v1/admin/trainers[/:id]` | 훈련사 계정 CRUD — `Admin` 테이블 `role: TRAINER` + `Trainer` 프로필(분야 태그, 소개) |
| PATCH | `/v1/admin/trainers/:id/status` | 활성/비활성 |
| GET | `/v1/admin/inquiries?status=&trainerId=&cursor=` | 전체 문의 모니터링 (SLA 임박 정렬) |
| POST | `/v1/admin/inquiries/:id/assign` | 훈련사 수동 배정 (자동 배정 여부는 §10 미확정) |
| GET | `/v1/admin/settlements?month=YYYY-MM` | 월 정산 목록 (`TrainerSettlement`) — 훈련사별 답변 건수·차감 포인트 합·정산 비율·지급액 |
| POST | `/v1/admin/settlements/:id/confirm` | 정산 확정 (지급 처리 기록, AuditLog) |

### 5.6 TRAINER 롤 전용 (`/v1/trainer/*`) ★

`RolesGuard: TRAINER` — 본인 리소스만 접근(배정 trainerId = JWT sub 검증). ADMIN 라우트 접근 시 403.

| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/trainer/me` | 내 프로필 (분야 태그 포함) |
| GET | `/v1/trainer/inquiries?status=&cursor=` | **본인 배정** 문의 목록 (SLA 남은 시간 표시) |
| GET | `/v1/trainer/inquiries/:id` | 문의 상세 (보호자 영상 재생 URL, 질문, 강아지 프로필 요약) |
| POST | `/v1/trainer/inquiries/:id/answer-upload-url` | 답변 영상 presigned URL (텍스트만도 가능) |
| POST | `/v1/trainer/inquiries/:id/answer` | 답변 제출 `{ text, videoKey? }` → ANSWERED, 보호자 푸시 |
| GET | `/v1/trainer/settlements?cursor=` | **본인 정산** 내역 조회 (읽기 전용) |

### 5.7 회원 / 포인트 / 기타 (유지·개정)

| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/admin/users?q=&status=` / `/:id` | 회원 조회 (탈퇴 회원은 `deletedAt not null` 명시 조회) |
| PATCH | `/v1/admin/users/:id/status` | SUSPEND/ACTIVATE |
| POST | `/v1/admin/users/:id/points/adjust` | 포인트 수동 조정 (사유 필수, AuditLog) |
| GET | `/v1/admin/points/ledger?userId=&type=&cursor=` | 원장 조회 |
| GET | `/v1/admin/recharges?channel=&status=&cursor=` | 충전 내역 (PortOne/IAP) |
| POST | `/v1/admin/recharges/:id/refund` | 충전 환불 트리거 (PortOne cancel API / IAP 안내, 정책 §10 미확정) |
| — | `/v1/admin/shop/*`, `/v1/admin/content/*`, `/v1/admin/notifications/*`, `/v1/admin/admins/*`, `/v1/admin/audit-logs`, `/v1/admin/reports/*` | 기존 유지 (표준 CRUD 패턴) |

---

## 6. 결제 흐름 시퀀스 (D10·D15)

충전 진입 시 클라이언트 채널로 분기한다. **앱(shell) 내 WebView에서 PortOne 결제창 노출 금지, 앱 내 웹 가격 안내(스티어링) 금지.**

### 6.1 웹 채널 — PortOne

```
[mobile-web (브라우저)]
 1) GET /v1/recharge/packages          (X-Client-Channel: web → 웹 가격표)
 2) POST /v1/recharge/orders { packageId } + Idempotency-Key
    서버: PointRecharge PENDING 생성, PortOne 사전등록(merchant_uid, amount)
    ← { rechargeId, portOnePayload }
 3) PortOne JS SDK로 결제창 진행 (카드/간편결제)
 4) 결제 완료 → PortOne이 POST /v1/recharge/webhook/portone 호출
[서버 webhook]
 5) HMAC 서명 검증 → PortOne API 재조회(imp_uid)로 금액/상태 대조
 6) payment_event_log로 중복 수신 멱등 처리
 7) point-settler `recharge` 잡:
    트랜잭션 — PointRecharge PAID, PointLedger `recharge`(+P, expiresAt=+1년), Wallet 증가
 8) 보호자 푸시("10,000P 충전 완료") — notification-dispatcher
```

### 6.2 앱 채널 — IAP (Google Play / App Store)

```
[android-shell / ios-shell]
 1) GET /v1/recharge/packages          (X-Client-Channel: android|ios → IAP 가격표만)
 2) POST /v1/recharge/orders { packageId }
    ← { rechargeId, storeProductId }
 3) 네이티브 IAP 구매 플로우 (스토어 결제)
 4) POST /v1/recharge/orders/:id/iap-receipt { platform, receipt }
[서버]
 5) Google Play Developer API / App Store Server API로 영수증 검증
    (productId·구매상태 확인, 중복 영수증 거부)
 6) 검증 성공 → point-settler `recharge` 잡 (6.1의 7~8과 동일)
 7) 소비성 상품 consume/acknowledge 처리
```

주: 상품(포인트샵) 결제는 **전액 포인트**이므로 IAP 대상 아님. 현금이 개입하는 지점은 충전뿐 — 채널 분기도 여기에만 존재.

---

## 7. 이벤트 / 비동기 작업 (Worker)

### 7.1 도메인 이벤트 → 큐 매핑

| 이벤트 | 발행 시점 | 소비 큐 |
|---|---|---|
| `lesson.watch_completed` | 시청완료 보고 승인 | `point-settler`(P_watch), `lesson-evaluator` |
| `lesson.practice_completed` | 실습 자가체크 성공 | `point-settler`(P_practice), `lesson-evaluator` |
| `lesson.quiz_passed` | 퀴즈 최초 통과 | `point-settler`(P_quiz), `lesson-evaluator` |
| `lesson.completed` | 3단계 모두 완료 | `lesson-evaluator`(잠금 해제·완주 판정·데일리 목표·배지/학년), `notification-dispatcher` |
| `course.completed` / `unit.completed` | 완주 판정 | `point-settler`(완주 보너스), `notification-dispatcher`(배지 획득) |
| `recharge.paid` | PortOne webhook / IAP 검증 성공 | `point-settler`(충전 지급) |
| `inquiry.created` | 문의 생성(차감 완료 후) | `inquiry-sla-watcher`(48h 지연 잡), `video-postprocess`(문의 영상) |
| `inquiry.answered` | 훈련사 답변 | `notification-dispatcher`, 정산 집계(월 배치) |
| `order.paid` | 샵 주문 확정 | `order-fulfillment`(실물), 즉시 지급(디지털) |

### 7.2 큐 목록

| Queue | Job | 트리거 | 처리 |
|---|---|---|---|
| `point-settler` | `grant` / `spend` / `recharge` / `refund` | 위 이벤트 | 단일 트랜잭션 원장+지갑. 차감은 FIFO 소진 |
| `lesson-evaluator` | `on-event` | 레슨 이벤트 | 진도 갱신, 잠금 해제, 완주/배지/학년 판정, 데일리 목표 달성 체크 (구 mission-evaluator 개편) |
| `inquiry-sla-watcher` | `check-sla` (지연 잡) | 문의 생성 +48h | 미답변이면 자동 환불(`refund` 잡) + REFUNDED 전이 + 양측 알림 |
| `point-expirer` | cron `0 3 * * *` | 매일 새벽 | `expiresAt` 도래 적립분 소멸 차감 기록, D-30/D-7 소멸 예정 푸시 예약 |
| `notification-dispatcher` | `push` / `email` / `schedule` | 이벤트·데일리 리마인드 | FCM 호출 (APNs는 FCM 위임), 실패 토큰 정리 |
| `video-postprocess` | `transcode` | Q&A 문의/답변 영상 업로드 | 트랜스코딩·썸네일 (강의 영상은 YouTube — 대상 아님) |
| `order-fulfillment` | `process` | 실물 주문 확정 | 송장 생성, 상태 전이 |
| `vaccine-reminder` | `schedule` | 접종 기록 추가 | D-7/D-1 알림 예약 |
| `daily-rollup` | cron | 매일 새벽 | KPI 집계, 정산 월 집계 |

제거: `mission-evaluator`(→ lesson-evaluator로 개편).

---

## 8. 외부 통합 인터페이스

### 8.1 PortOne (웹 충전 전용)

- 사전등록: `merchant_uid`(= rechargeId), `amount` 등록
- webhook: `POST https://api.waggle.app/v1/recharge/webhook/portone` — HMAC 검증 + `imp_uid` 재조회 대조 + `payment_event_log` 멱등
- 환불: 관리자가 AAPI에서 트리거 → PortOne `/payments/cancel`
- **앱 배포판 WebView에서 PortOne 결제창을 띄우지 않는다** (스토어 정책 리스크, D15)

### 8.2 IAP (앱 충전 전용)

- Android: Google Play Billing — 서버에서 Play Developer API `purchases.products.get`으로 검증 후 지급·consume
- iOS: StoreKit 2 — App Store Server API로 트랜잭션 검증
- 충전 패키지 ↔ 스토어 productId 매핑은 `PolicyConfig`(`recharge.packages.iap`)에서 관리
- 채널별 가격 차등 허용, 앱 내 웹 가격 노출 금지

### 8.3 YouTube (강의 영상)

- unlisted 영상을 **IFrame Player API**로 mobile-web에서 임베드 (D6)
- 서버/CMS는 `videoId`와 영상 길이만 보관 — 원본 파일·스트리밍 인프라 없음
- 시청 판정은 클라이언트(Player API 진도 이벤트) + 서버 무결성 검증(§3.5)
- 리스크 대응: videoId 노출 최소화(레슨 상세는 인증 필수), 장기적으로 S3+HLS 전환 경로 유지

### 8.4 FCM / APNs

- FCM 단일 채널(APNs는 FCM 위임), 토큰 직접 지정. 실패(UnregisteredToken) 시 `Device` 삭제
- 모바일웹 단독 사용자는 푸시 제한(D14) — 알림함(`/v1/notifications`)으로 보완

---

## 9. 도메인 계층 (packages/domain)

프레임워크 독립, 순수 로직. 커버리지 85%+ 목표.

- `education/progress.ts` — 레슨 3단계 완료 판정, 순차 잠금, 코스/유닛 완주 판정
- `education/reward.ts` — 단계별 적립·완주 보너스 계산 (정책값 주입형, 일일 상한 반영)
- `education/grade.ts` — **이수도 → 학년** 계산 (구 월령 기반 대체)
- `matching/score.ts` — 설문 답변 태그 ↔ 코스 태그 가중치 매칭 점수
- `quiz/grade.ts` — 채점, 통과 판정 (통과 기준 주입형)
- `points/ledger.ts` — 원장 규칙, **FIFO 소멸/차감**, 유효기간 계산
- `shop/pricing.ts` — 포인트 결제 계산 (현금 혼합 제거)
- `shop/stock.ts` — 재고 감소/복구
- `inquiry/sla.ts` — SLA 기한·환불 판정

제거: `walks/*`, `missions/engine.ts`(→ education/matching으로 대체).

---

## 10. OpenAPI / 문서화 (유지)

- `@nestjs/swagger`로 OpenAPI 3.1 자동 생성, 빌드 시 `openapi.json` 산출 → `@waggle/dto` 타입 검증 비교
- Redocly 정적 HTML → admin-web `/docs` 임베드
- k6 부하 시나리오: `walk-completion.js` → **`lesson-completion.js`**로 대체 (시청완료→실습→퀴즈 루프)

---

## 11. 오픈 이슈

1. **Q&A 배정 방식**: 관리자 수동 vs 분야 태그 자동 배정 (스펙 §10-3 미확정) — API는 수동 배정(`/assign`) 우선, 자동 배정은 확장 여지로 설계
2. **환불 정책**: 충전 포인트 환불(PortOne/IAP 각각), 미사용 문의권 환불 기준 (스펙 §10-2 미확정)
3. **정책 초기값**: 포인트 단가·보너스·가격표 런칭 초기값 (구조 확정, 값 미정 — 스펙 §10-1)
4. **시청완료 서버 검증 강도**: 클라이언트 판정 신뢰 수준 vs 세션 하트비트 추가 여부
5. **BFF `/v1/home/summary` 캐시**: 사용자별 Redis 60초 캐시 여부
6. **CMS 게시 버전과 수강생 진도 정합성**: 게시 중 레슨 삭제 시 기존 `LessonProgress` 처리 규칙
