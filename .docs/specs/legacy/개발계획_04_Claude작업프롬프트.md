# 개발계획 04 — Claude Code(CLI) 전환 작업 프롬프트

작성일: 2026-07-22 · 대상: 교육앱 피벗 전환 작업 (스펙 §11, 스프린트 S1~)

## 사용법

- 레포 루트에서 `claude` 실행 후 아래 프롬프트를 **순서대로 하나씩** 붙여넣는다. 한 프롬프트 = 한 세션(또는 `/clear` 후 다음) 권장.
- CLAUDE.md가 이미 새 아키텍처 기준으로 갱신돼 있으므로 Claude가 자동으로 컨텍스트를 갖는다.
- 각 프롬프트 말미의 **완료 조건**이 충족됐는지 확인 후 커밋하고 다음으로 넘어간다.
- DB 작업(1단계)은 파괴적이므로 실행 전 반드시 결과 SQL을 검토한다.

---

## 프롬프트 1 — DB 백업 (public_backup / admin_backup)

```
documents/기획_교육앱_스펙정의.md §11과 documents/아키텍처_03_데이터모델.md §7(마이그레이션 계획)을 읽고, 개발 DB(waggle_dev, 114.207.113.140)의 스키마 백업 스크립트를 작성해줘.

요구사항:
1. infra/scripts/backup-schemas.sh 생성 — pg_dump로 public·admin 스키마를 덤프한 뒤 스키마명을 public_backup·admin_backup으로 치환해 같은 DB에 복원(데이터 포함). 시퀀스/인덱스/제약조건 포함.
2. 복원 후 public_backup·admin_backup에 대해 waggle_mapi_user, waggle_aapi_user의 모든 권한 REVOKE (읽기 포함 차단), prisma_migrator는 유지.
3. 검증 쿼리 포함: 스키마별 테이블 수·행 수 비교 (원본 vs backup).
4. 스크립트는 idempotent하지 않아도 되지만, backup 스키마가 이미 존재하면 중단하고 경고할 것.
5. 실행은 하지 말고 스크립트와 실행 방법·주의사항을 README 주석으로 남겨줘. .env의 접속정보를 읽되 커밋되는 파일에 비밀번호를 넣지 마.

완료 조건: 스크립트 리뷰 가능 상태, dry-run 설명 포함.
```

## 프롬프트 2 — Prisma 스키마 개편 + 마이그레이션

```
documents/아키텍처_03_데이터모델.md v1.0을 기준으로 packages/prisma/prisma/schema.prisma를 전면 개편해줘.

요구사항:
1. 유지 모델(User, Dog, Breed, Point, Shop/Order, 알림, DailyEntry 등)은 기존 정의를 보존하되 문서와 다르면 문서 기준으로 수정.
2. 폐기 모델 제거: Walk, WalkPhoto, 7월에 추가된 구 교육 모델(Course/Quiz/CourseProgress/CourseCategory 등), Mission 계열.
3. 신규 교육 도메인 모델 27개(문서 §5 코드 블록 그대로): Course/Unit/Lesson/LessonStep/PracticeChecklist/Quiz/QuizQuestion/QuizAttempt/Enrollment/LessonProgress/Survey·Tag 계열/LevelTest 계열/Trainer/TrainerTag/Inquiry/PointRecharge/DailyGoal/Badge/DogBadge/CourseUnlock.
4. admin 스키마: Admin에 TRAINER 롤 추가, TrainerSettlement, PolicyConfig, PolicyConfigHistory 추가.
5. PointLedger 개편: expiresAt·remaining 컬럼, PointReason enum 전면 개편(문서 기준), 부분 인덱스는 마이그레이션 SQL에 수동 추가.
6. 컨벤션 준수: uuid_generate_v7 PK, soft delete, @@schema 명시, CLAUDE.md의 "migration.sql 수동 추가 필수 항목" 반영. PostGIS 구문은 넣지 말 것.
7. pnpm --filter @waggle/prisma migrate:dev -- --name education_pivot 으로 마이그레이션 생성 후, 생성된 SQL을 검토해 drop 순서(FK 역순)가 맞는지 확인.
8. seed.ts를 새 스키마에 맞게 수정: PolicyConfig 기본값 15개 키(문서 §4 카탈로그), 설문 7문항+태그(스펙 §4.1.1), 샘플 코스 1개(유닛 2, 레슨 4, 퀴즈 포함), 테스트 계정.

완료 조건: prisma generate 성공, migrate:dev 적용 성공, seed 실행 성공, pnpm --filter @waggle/prisma build 통과. 단, 프롬프트 1의 백업이 완료된 후에만 migrate를 실행할 것.
```

## 프롬프트 3 — RN 및 산책 코드 제거

```
교육앱 피벗(D14, D23)에 따라 RN과 산책 관련 코드를 제거해줘.

요구사항:
1. 디렉터리 삭제: apps/mobile-app, apps/poc-walk, packages/native-walk. pnpm-workspace.yaml·turbo.json·tsconfig 레퍼런스·CI 워크플로에서 참조 제거.
2. apps/mobile-api: walks·missions 모듈 삭제, app.module.ts에서 제거. education 모듈은 남기되 구 구현은 documents/아키텍처_04_API설계.md 기준으로 재작성 대상이므로 일단 컴파일만 되게 정리(구 Course 모델 참조 제거).
3. apps/admin-api: walks·missions 모듈 삭제, education 모듈 동일 처리.
4. packages/domain: walks/·missions/ 삭제, dogs/grade.ts는 유지(후속 태스크에서 이수도 기반으로 교체 예정임을 TODO 주석).
5. worker의 mission-evaluator 관련 프로세서 제거(큐 개편은 후속 태스크).
6. infra/k6/walk-completion.js 삭제.
7. 전체에서 잔여 참조 검색(walk, mission, native-walk, poc-walk) 후 정리. documents/ 폴더는 건드리지 말 것.

완료 조건: pnpm install && pnpm build && pnpm test 전부 통과 (기존 테스트 중 walk/mission 테스트는 삭제). 커밋 메시지: "chore: remove RN apps and walk/mission modules (education pivot D14/D23)"
```

## 프롬프트 4 — mobile-web 스캐폴드

```
documents/아키텍처_08_모바일웹_아키텍처.md를 읽고 apps/mobile-web을 스캐폴드해줘.

요구사항:
1. Next.js 15 App Router + TypeScript strict + Tailwind CSS v4, @waggle/design-tokens 토큰 연결. admin-web의 설정 방식을 참고해 모노레포 컨벤션(tsconfig.base 상속, ESLint flat config) 준수.
2. 라우팅 골격(페이지는 플레이스홀더): 온보딩(/onboarding: profile→survey→result→level-test→daily-goal), 홈 커리큘럼 경로(/), 레슨(/lesson/[id]/watch|practice|quiz), 교육기록(/record), 일상기록(/daily), 포인트샵(/shop), 포인트/충전(/wallet), Q&A(/inquiry), 마이(/my). 하단 탭 네비게이션 레이아웃.
3. 공통 인프라: TanStack Query v5 Provider, API 클라이언트(응답 래퍼 {data,meta,error} 언래핑, X-Client-Channel 헤더 — 브릿지/UA 감지 유틸 포함), JWT 인증(쿠키) 훅 골격.
4. YouTube IFrame Player API 래퍼 컴포넌트 골격: onProgress 콜백으로 시청 세그먼트 수집, 95% 판정 인터페이스(구현은 후속).
5. turbo.json에 dev/build 파이프라인 추가, pnpm --filter mobile-web dev 동작 확인.

완료 조건: pnpm --filter mobile-web build 통과, dev 서버에서 탭 네비게이션과 전 라우트 이동 가능.
```

## 프롬프트 5 — MAPI 교육 도메인 API (스프린트 S2~S4 반복 사용)

```
documents/아키텍처_04_API설계.md의 [모듈명] 모듈을 구현해줘. (모듈명을 바꿔가며 반복 사용: onboarding → curriculum → lesson → points 개편 → recharge → inquiry → daily-goal/badges → dailylog)

공통 요구사항:
1. 스펙: documents/기획_교육앱_스펙정의.md 해당 섹션 + 아키텍처_04의 엔드포인트 정의를 그대로 따를 것.
2. 정책값은 admin.PolicyConfig 로더(공통 서비스)를 통해 읽고 하드코딩 금지 (D16).
3. 포인트 적립/차감은 단일 트랜잭션 + point-settler 큐 경유, 적립 건 expiresAt=+1년, 차감 FIFO (D21).
4. 순수 로직(보상 계산, 태그 매칭 점수, FIFO 소진, 학년 계산)은 packages/domain에 두고 Vitest 단위 테스트 85%+.
5. 서비스/컨트롤러 테스트 + 핵심 경로 Supertest E2E 1개 이상.
6. DTO는 packages/dto에 Zod 스키마로 정의해 mobile-web과 공유.

완료 조건: pnpm --filter mobile-api test && test:e2e 통과, 응답 래퍼·에러 규약 준수.
```

## 프롬프트 6 — AAPI: CMS·정책·훈련사 (스프린트 S2~S6 반복 사용)

```
documents/아키텍처_04_API설계.md의 AAPI [모듈명] 모듈을 구현해줘. (반복: cms → matching → policy → trainers/inquiries/settlements → trainer-portal)

공통 요구사항:
1. 모든 쓰기 액션 AuditLog 기록 필수.
2. RBAC: ADMIN/TRAINER 롤 가드, trainer-portal(/v1/trainer/*)은 본인 배정 문의·본인 정산만 접근(deny-by-default). 테스트로 교차 접근 차단 검증.
3. PolicyConfig 변경은 PolicyConfigHistory에 이력 기록.
4. admin-web 화면은 별도 프롬프트로 진행하므로 API만.

완료 조건: pnpm --filter admin-api test 통과, RBAC 테스트 포함.
```

## 프롬프트 7 — worker 큐 개편

```
documents/아키텍처_04_API설계.md의 이벤트→큐 매핑 표를 기준으로 worker를 개편해줘.

요구사항:
1. lesson-evaluator(구 mission-evaluator 대체): lesson.step.completed → 진도/배지/데일리 목표 갱신.
2. point-expirer: 매일 실행, expiresAt 경과 적립 건 FIFO 소멸 + EXPIRE 원장 기록, 소멸 30일/7일 전 대상 추출 → notification-dispatcher로 발행.
3. inquiry-sla-watcher: 48시간 경과 미답변 Inquiry → 자동 환불(포인트 복구) + 알림.
4. notification-dispatcher에 신규 알림 타입 추가: 데일리 리마인드, Q&A 답변 도착, 포인트 소멸 예정.
5. 각 프로세서 Testcontainers 통합 테스트.

완료 조건: pnpm --filter worker test 통과.
```

## 프롬프트 8 — mobile-web 기능 구현 (스프린트 S3~ 반복 사용)

```
documents/기획_교육앱_IA_화면설계.md의 [화면 ID 범위]를 구현해줘. (반복: ONB-01~10·SUR-01~07 → HOM-01~03 → LSN-01~06 → PNT/SHP → QNA → DLY/REC/MY)

공통 요구사항:
1. 화면설계 문서의 구성 요소·상태(빈/로딩/에러)·인터랙션을 따르고, API는 아키텍처_04 기준으로 packages/dto 스키마 사용.
2. 포인트 적립 연출은 낙관적 UI (D7: 시청/실습/퀴즈 각 1회).
3. 레슨 플레이어는 YouTube IFrame 래퍼로 95% 판정(배속 허용), 시청 세그먼트 합산 방식.
4. 충전 화면(PNT-02)은 X-Client-Channel 분기: web→PortOne, android/ios→IAP 안내. 앱 채널에서 웹 가격 문자열이 렌더되지 않음을 테스트로 검증 (D15 스티어링 금지).
5. 모바일 뷰포트(390px) 기준, 데스크톱은 중앙 고정폭.

완료 조건: pnpm --filter mobile-web build 통과 + 주요 컴포넌트 테스트.
```

## 프롬프트 9 — android-shell (스프린트 S7)

```
documents/아키텍처_08_모바일웹_아키텍처.md §4를 기준으로 apps/android-shell을 생성해줘.

요구사항:
1. Kotlin, 최소 SDK 26. WebView 단일 액티비티: mobile-web URL 로드, JS Bridge(getChannel/getPushToken/openNotificationSettings/getAppVersion) 구현.
2. FCM: 토큰 발급 → 브릿지로 웹에 전달, 알림 탭 → 딥링크(@waggle/deeplinks 라우트) → WebView 라우팅.
3. 파일 업로드(input capture, 카메라 권한), 쿠키 유지, 뒤로가기 처리.
4. debug/release 빌드 설정, Play 테스트 트랙용 서명 설정 골격(키는 커밋 금지).

완료 조건: ./gradlew assembleDebug 성공, 브릿지 인터페이스 문서화.
```

---

## 진행 순서 요약

| 순서 | 프롬프트 | 스프린트 | 선행 조건 |
|---|---|---|---|
| 1 | DB 백업 | S1 | — |
| 2 | Prisma 개편 | S1 | 1 실행 완료 |
| 3 | RN/산책 제거 | S1 | 2 |
| 4 | mobile-web 스캐폴드 | S1 | 3 |
| 5 | MAPI 모듈들 (반복) | S2~S5 | 2, 4 |
| 6 | AAPI 모듈들 (반복) | S2~S6 | 2 |
| 7 | worker 개편 | S3~S6 | 5 일부 |
| 8 | mobile-web 화면 (반복) | S3~S6 | 4, 5 |
| 9 | android-shell | S7 | 8 |

세부 태스크·의존성은 `개발계획_02_MVP상세.md`(WGL-EDU-Sxxx) 참조.
