# Business & Data Flows (Waggle SSOT)

> 핵심 도메인(인증/세션, 포인트 원장·충전 환불, 포인트샵 주문·구매확정·후기, 동시성 잠금, 파일 업로드, 정기 배치)의 데이터 흐름 및 상태 전이 시퀀스를 기록합니다.

## 1. 인증 및 세션 이원화 흐름 (DB SHA-256 세션 기반)
- **공통 엔진**: `32B 무작위 키 쿠키(HttpOnly; Secure; SameSite=Lax)` ↔ PostgreSQL `SHA-256(hex)` 해시 대조 + React `cache()` 요청당 1회 검증.
- **`(mobile)` `/app/*` (`WAGGLE_APP_SESSION`, `path: "/"`)**:
  - 로그인(이메일/소셜): 기존 활성 세션이 있으면 즉시 `revoked_reason = 'DUPLICATE_LOGIN'`으로 종료(중복 로그인 금지) ➔ 신규 세션 발급.
  - 가입·재로그인 3단 분기 (`resolveUserPostAuthPath` + `requireUserSession` 전역 가드): `terms_agreed_at IS NULL` ➔ `/app/onboarding/extra` (필수 약관·추가정보 미완료 시 `/app/*` 직접 진입도 자동 차단) · `terms_agreed_at IS NOT NULL && onboarding_completed_at IS NULL` ➔ `/app/onboarding/profile` (추가정보 재입력 없이 반려견 등록 이어서) · `onboarding_completed_at IS NOT NULL` ➔ `/app`.
  - 유지 정책: `idleMs: null`, `absoluteMs: null` (자동 로그아웃 없음) + 쿠키 `maxAge: 365일` 주기적 슬라이딩 재발급.
  - 기존 기기 요청 시 `DUPLICATE_LOGIN` 감지 ➔ `/api/auth/session-expired?reason=duplicate` 경유 ➔ 로그인 화면 `useAlert` 안내.
  - 비밀번호 변경 · 계정 정지(`SUSPENDED`) · 회원 탈퇴 시 즉시 DB 세션 강제 폐기(`SECURITY_RESET`).
- **`(admin)` `/admin/*` (`WAGGLE_ADMIN_SESSION`, `WAGGLE_ADMIN_OTP`, `path: "/admin"`)**:
  - `LOGIN_PROCESS_STANDARD` 100% 준수: ID/PW 검증 ➔ 2단계 문자 인증번호(OTP) ➔ 30분 슬라이딩 세션 · 단일 세션 · 5회 오답 계정 잠금.
  - `proxy.ts` 3도메인 Host 분기: 운영 환경에서 `admin.*` 호스트 외의 `/admin` 직접 접근은 404 차단.

## 2. 전역 동시성 잠금 · 멱등성 · Stale 탭 차단 규칙
- **전역 행 잠금 순서 (데드락 원천 차단)**: `point_wallets (FOR UPDATE)` ➔ 도메인 행(`orders` / `point_recharges` / `carts` / `inquiries`) ➔ `products` / `product_variants` (`id ASC`) ➔ `point_ledgers` (`id ASC`).
- **중복 거래 차단**: `orders`, `point_recharges`, `inquiries`의 `idempotency_key` Partial UNIQUE + 클라이언트 `useSubmitLock` 0ms 동기 가드.
- **Stale 탭 차단 (`BALANCE_STALE`)**: 결제·충전·문의 시 화면 로드 시점 `expectedWalletBalance`와 잠긴 `point_wallets.balance`가 다르면 차단 후 최신 잔액 안내.

## 3. 결제·충전 및 환불 흐름
- **충전 웹훅 (`POST /api/webhooks/portone`)**: 서명 검증 ➔ PG 재조회 금액 대조 ➔ 단일 PostgreSQL 트랜잭션(`payment_event_logs` UNIQUE 멱등 + `point_recharges FOR UPDATE` `PAID` 전이 + `point_ledgers` INSERT + 잔액 UPDATE) ➔ 응답 후 `after()` 단건 알림.
- **충전 취소·환불 (GM-103)**:
  - **미사용 + 결제 7일 이내**: 사용자 `cancelMyRechargeAction`으로 즉시 취소 (`RECHARGE_REFUND` 원장 회수 + `CANCELLED`/`REFUNDED`).
  - **부분 사용 또는 7일 경과**: 사용자 `requestRechargeRefundAction` (`REFUND_REQUESTED`) ➔ 관리자 `/admin/recharges`에서 잔여 충전분 원가 비례 환불 승인(`adminApproveRechargeRefundAction`) 또는 반려(`adminRejectRechargeRefundAction`).

## 4. 포인트샵 주문 · 배송 · 구매확정 · 후기 상태 전이
```text
PAID (결제 완료: 배송지 변경 · 즉시 취소 전액 환불)
  └─▶ PREPARING (배송 준비: 취소 신청 → CANCEL_REQUESTED → 관리자 승인 REFUNDED / 반려)
        └─▶ SHIPPING (배송 중)
              └─▶ DELIVERED (배송 완료: 7일 이내 반품 신청 RETURN_REQUESTED 또는 구매 확정)
                    ├── [반품 신청] ──▶ RETURN_REQUESTED ──▶ 관리자 승인 REFUNDED (재고 복구 + 포인트 환불)
                    └── [구매 확정 / +7일 크론 자동 확정] ──▶ CONFIRMED (반품 불가 확정)
                                                            └─▶ 실물(PHYSICAL) 품목당 1회 후기 작성
                                                                (단일 TX: product_reviews INSERT + REVIEW_REWARD 1회 적립)
                                                                (본인 수정 가능 · 삭제 불가 · 관리자 숨김/공식 답글)
```
- **디지털 상품 (`PREMIUM_UNLOCK`, `INQUIRY_TICKET`)**: 결제 즉시 완료 처리(`course_unlocks` 발급 등), 배송/반품/후기 대상 제외.

## 5. 파일 업로드 및 `.env` 경로 서빙 흐름
- **관리자 업로드 (`POST /admin/api/upload?category=products|editor`)**: `WAGGLE_ADMIN_SESSION` (`path="/admin"`) 검증 ➔ `sharp` 디코딩·EXIF 제거·1200px WebP 변환 ➔ `UPLOAD_DIR/{category}/{YYYYMM}/{file}.webp` 저장.
- **사용자 업로드 (`POST /api/upload?category=reviews|inquiries`)**: `WAGGLE_APP_SESSION` 검증 ➔ 이미지는 `sharp` WebP 변환(문의 영상은 mp4/mov/webm 허용) ➔ `UPLOAD_DIR/{category}/{YYYYMM}/` 저장.
- **서빙 (`GET /api/uploads/[...path]`)**: `UPLOAD_DIR` 기준 Path Traversal 검증 후 `Cache-Control: public, max-age=31536000, immutable` 응답 (소프트 삭제 복원 정합성을 위해 디스크 파일은 즉시 물리 삭제하지 않음).

## 6. 정기 배치 (`POST /api/cron/*`, `CRON_SECRET` 인증)
- `/api/cron/expire-points`: 만료 도래 `point_ledgers` 로트 FIFO 소멸 (`point_wallets` 선잠금).
- `/api/cron/inquiry-sla`: 48h 답변 지연 Q&A 자동 환불 (`inquiry-refund:{id}` 단일 멱등키).
- `/api/cron/confirm-orders`: 배송 완료(`DELIVERED`) + 7일 경과 실물 주문 자동 `CONFIRMED` 전환 + 후기 안내 알림.
- `/api/cron/daily-reminder`: 데일리 학습 리마인더 알림 발송.
