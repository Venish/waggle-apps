# Codebase Reference (Waggle SSOT)

> 프로젝트 내 핵심 Server Actions(`03_actions`), Route Handlers(`app/api/*`, `app/(admin)/admin/api/*`), Business Services(`04_services`), PostgreSQL 18 DAL(`packages/db`) 및 공용 계약(`@repo/types`, `@repo/ui`)의 시그니처와 역할을 기록합니다.

- **현재 상태 (As-Built 2026-11-23)**: PostgreSQL 18 **62개 물리 테이블** · **73개 전 화면(`(www)` 1 · `(mobile)` 39 · `(admin)` 33)** · **13개 Route Handlers** · **11개 Server Action 모듈** 구축 및 `typecheck`/실서버 E2E 검증 완료.
- **패키지 구성**:
  - `@repo/db`: PostgreSQL 18 Drizzle `pg-core` 62테이블(`src/schema/01_auth.ts ~ 10_operations.ts`, `user_tickets` 포함) · `getDb()`/`pingDatabase()` · 멱등 `src/seed.ts`(견종 40종 · 상품 4종 · 카테고리 7종 · 후기 정책 4종 · `UPLOAD_DIR` 파일 동기화 포함)
  - `@repo/types`: `ActionResult<T>`, `AppError`(`BALANCE_STALE` 포함), `MENU_REGISTRY`(`A-14`, `A-15` 포함), 순수 도메인 계산 엔진 7종(`src/domain/{dog-math,education-math,matching-fifo}.ts`)
  - `@repo/ui`: 테마 중립 구조·브랜드 프리미티브(`ModalShell`, `cn`, `WaggleMark`, `WaggleWordmark`, `PointIcon`)

## 1. Core Library (`apps/web/src/00_lib/` & `02_hooks/`)
- `env.ts`: `getServerEnv()` — `GM-011` Strict `.env` Zod 검증 (`UPLOAD_DIR`, `UPLOAD_PUBLIC_BASE_URL` 포함)
- `password.ts`: `hashPassword`, `verifyPassword` (`scryptSync`), `generateRandomToken`, `sha256Hex`, `generateNumericOtp`
- `userSessionConfig.ts` / `adminSessionConfig.ts`: 쿠키명(`WAGGLE_APP_SESSION`, `WAGGLE_ADMIN_SESSION`, `WAGGLE_ADMIN_OTP`, 관리자 `path: "/admin"`) 및 `.env` 정책 로더
- `session.ts`: React `cache()` 기반 `checkCurrentUserSession`, `requireUserSession`, `createUserSession`, `revokeAllUserSessions`, `checkCurrentAdminSession`, `requireAdminSession`, `createAdminSession`
- `uploadStorage.ts`: `resolveUploadRootDir`, `saveUploadedFile`(`sharp` 강제 디코딩 · EXIF 제거 · 1200px/600px WebP · 영상 Magic Bytes 검증), `statUploadedFileSafe`(Path Traversal 차단), `createUploadStreamResponse`(ReadStream + HTTP Range 206), `listUploadedFilesOlderThan`
- `uploadClient.ts`: 공용 업로드 클라이언트 `uploadMediaFile`(15MB 이미지 / 50MB Q&A 영상 / 150MB 교육 영상 선체크 · HTTP 413/비-JSON 방어 · XHR 실시간 `%` 진행률 콜백 · `formatFileSize`)
- `mediaUrl.ts`: `toAdminUploadUrl` / `toCanonicalUploadUrl` / `rewriteHtmlForAdminUploads` / `normalizeHtmlCanonicalUploads` / `extractYoutubeVideoId` / `isVideoMediaUrl` / `isImageMediaUrl`
- `nickname.ts`: `generateDefaultNickname`(`waggle_<6자리 고유코드>`), `resolveUserNickname`
- `sanitizeHtml.ts`: `sanitizeProductDetailHtml` (`sanitize-html` 기반 관리자 리치 에디터 HTML XSS 정제)
- `adapters.ts`: 외부 연동 경계 + 개발 Mock 어댑터 (`sendSmsOtpAdapter`, `sendPushAdapter`, `verifyPortoneWebhookSignature`, `saveUploadedFileLocal`)
- `formatDate.ts`: `formatDateDot` (`YYYY.MM.DD`), `formatDateTimeDot` (`YYYY.MM.DD HH:mm`) 전 화면 날짜 점(.) 포맷 표준
- `fonts.ts`: 셀프호스팅 `PretendardVariable.woff2` (`next/font/local`) 3대 레이아웃 단일 로드
- `mobileRoutePresentation.ts` / `mobileNavHistory.ts`: 38화면 4분류(`ROOT_TAB` · `BRAND_FLOW` · `SUB_PUSH` · `MODAL_PAGE`), ViewTransition 방향 판별 및 `sessionStorage` 내부 뒤로가기 스택
- `02_hooks/useSubmitLock.ts`: 0ms 동기 버튼 연타 차단 `useRef` 훅 + `createClientRequestKey` 멱등키 생성기
- `02_hooks/useHorizontalDragScroll.ts`: 모바일 네이티브 터치 스와이프(`.swipe-x`) + 데스크톱 마우스 드래그 스크롤 공용 훅 (`onClickCapture` 드래그 클릭 충돌 차단)

## 2. Shared Server-Only Services (`apps/web/src/04_services/shared/`)
- `policyService.ts`: `getPolicyNumber`, `getPolicyBoolean`, `getPolicyString`, `getRechargePackagesPolicy`, `getShopReviewPolicy` (`policy_configs` 단일 조회 · Fail-Fast)
- `pointLedgerService.ts`: `ensureWalletLocked`(`ON CONFLICT DO NOTHING` + `FOR UPDATE`), `earnPointsTx`, `spendPointsFifoTx`(멱등 선조회 · 미만료 `FOR UPDATE`), `revokeRechargeLedgerTx`, `getWalletSummary`
- `commerceRefundService.ts`: `ORDER_RETURN_WINDOW_MS`(7일), `restoreOrderStockTx`, `computeRechargeRefundMeta`(GM-103 잔여 충전분 원가 비례 환불)
- `shopReviewService.ts`: `maskReviewerNickname`, `getPrimaryProductImagesMap`, `getProductReviewSummaryMap`, `computeReviewStats`
- `auditService.ts`: `recordAuditLog`, `restoreSoftDeletedEntity`

## 3. Server Actions (`apps/web/src/03_actions/`)
- **사용자 (`web/` — `admin/` 상호 import 0건)**:
  - `authActions.ts`: `userLoginAction`, `userSignupAction`, `userLogoutAction`, `updateUserSettingsAction`, `changeUserPasswordAction`
  - `dogDailyActions.ts`: `upsertDogAction`, `setPrimaryDogAction`, `deleteDogAction`, `saveDailyEntryAction`(다중 사진 5장 · 체중 · 최신 체중 `dogs.weightKg` 자동 동기화 · 스티커 추가/삭제), `deleteDailyEntryAction`, `createVaccinationAction`, `updateVaccinationAction`, `deleteVaccinationAction`
  - `onboardingEducationActions.ts`: `saveSurveyResponsesAction`, `submitLevelTestAction`, `enrollCourseAction`, `saveDailyGoalAction`, `completeLessonWatchAction`, `completeLessonPracticeAction`, `submitLessonQuizAction`
  - `walletShopActions.ts`: `createPointRechargeAction`, `addToCartAction`, `updateCartItemQtyAction`, `createShopOrderAction`(디지털 상품 `user_tickets` `AVAILABLE` 발급), `cancelMyOrderAction`(미사용 티켓 주문 즉시 취소 · `USED` 차단), `updateMyOrderAddressAction`, `requestOrderCancelOrReturnAction`, `withdrawOrderRequestAction`, `cancelMyRechargeAction`, `requestRechargeRefundAction`, `withdrawRechargeRefundAction`, `confirmMyOrderAction`, `createProductReviewAction`, `updateMyProductReviewAction`
  - `ticketActions.ts`: `redeemCourseTicketAction`(보유 티켓 1장 사용 → `USED` 발도장 + `course_unlocks` + `enrollments`), `unlockPremiumCourseWithPointsAction`(교육 화면 기본 포인트 차감 잠금 해제 + 상품 재고 차감 + 주문/`USED` 티켓 기록)
  - `inquiryNoticeActions.ts`: `createInquiryAction`(보유 `INQUIRY_TICKET` 우선 차감 또는 포인트 결제), `cancelInquiryAction`(포인트 환불 또는 문의권 티켓 `AVAILABLE` 원복), `markNotificationReadAction`
- **관리자 (`admin/` — `web/` 상호 import 0건)**:
  - `adminAuthActions.ts`: `adminLoginStep1Action`, `adminLoginStep2VerifyOtpAction`, `adminLogoutAction`, `createAdminAccountAction`, `updateAdminStatusAction`
  - `adminUserCodeActions.ts`: `adminUpdateUserStatusAction`, `adminForceRevokeUserSessionAction`, `adminAdjustUserPointsAction`, `adminCreateCommonCodeAction`, `adminSoftDeleteCommonCodeAction`, `adminCreateBreedAction`, `adminSoftDeleteBreedAction`
  - `adminEducationMatchingActions.ts`: `adminUpsertCourseAction`, `adminSoftDeleteCourseAction`, `adminAddUnitAndLessonAction`, `adminCreateTagAction`, `adminUpsertCourseTagWeightAction`, `adminCreateSurveyQuestionAction`
  - `adminCommerceActions.ts`: `adminUpsertCategoryAction`, `adminSoftDeleteCategoryAction`, `adminUpsertProductAction`(멀티 이미지·새니타이징 `detailHtml` 동기화), `adminSoftDeleteProductAction`, `adminUpdateOrderShipmentAction`, `adminCancelOrderRefundAction`, `adminRejectOrderRequestAction`, `adminApproveRechargeRefundAction`, `adminRejectRechargeRefundAction`, `adminToggleReviewHiddenAction`, `adminReplyProductReviewAction`, `adminUpdateShopReviewPoliciesAction`
  - `adminTrainerOpsActions.ts`: `adminAssignInquiryAction`, `trainerSubmitAnswerAction`, `adminGenerateMonthlySettlementAction`, `adminUpdateSettlementStatusAction`, `adminCreateTrainerAction`, `adminUpdatePolicyAction`, `adminCreateBannerAction`, `adminSoftDeleteBannerAction`, `adminSendNotificationAction`, `adminUpdateTemplateAction`, `adminRestoreEntityAction`

## 4. Route Handlers (`apps/web/src/app/api/` & `app/(admin)/admin/api/`)
- `GET /api/health/db`: PostgreSQL 18 연결 핑
- `GET /api/auth/session-expired`: 만료/중복 폐기 쿠키 삭제 후 로그인 리다이렉트
- `GET /api/auth/callback/[provider]`: 소셜 OAuth(카카오/Apple Mock) 콜백 → DB 단일 세션 발급
- `POST /api/webhooks/portone`: 서명/금액 검증 → `point_recharges FOR UPDATE` 단일 PostgreSQL ACID 충전 트랜잭션 → `after()` 알림
- `POST /api/upload`: **사용자 세션 전용** 업로드(`reviews` · `daily` 1200px WebP / `dogs` 600×600 1:1 WebP / `inquiries` 미디어) → `UPLOAD_DIR` 저장
- `POST /admin/api/upload`: **관리자 세션 전용**(`path="/admin"` 쿠키 격리 호환) 이미지 업로드(`products` / `editor`) → `sharp` WebP → `UPLOAD_DIR` 저장
- `GET /api/uploads/[...path]`: `UPLOAD_DIR` 스트리밍 + **HTTP `Range` (`206 Partial Content`)** 서빙 (**전 카테고리 로그인 세션 필수 401 + `cross-site` 핫링크 차단 403 + `private` 캐시**)
- `GET /admin/api/uploads/[...path]`: **관리자·훈련사 전용**(`path="/admin"` 쿠키 격리 호환) 스트리밍 + `Range 206` 서빙 (`cross-site` 403 차단)
- `POST /api/cron/expire-points` · `/api/cron/inquiry-sla` · `/api/cron/daily-reminder` · `/api/cron/confirm-orders` · `/api/cron/cleanup-uploads`: `CRON_SECRET` 헤더 검증 배치 (만료 소멸 · 48h Q&A SLA 환불 · 데일리 리마인드 · 배송완료 +7일 자동 구매확정 · 24h+ 고아 업로드 정리)
