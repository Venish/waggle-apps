# 🖼️ 이미지 에셋 · 업로드 스토리지 · 브랜드 마크 가이드 (Image Asset Guide)

> **문서 상태:** 활성 (Active SSOT · 2026-11-23 현행화)  
> **적용 범위:** 와글(Waggle) 정적 에셋(`public/images/`), `.env` 기반 로컬 업로드(`UPLOAD_DIR`), 브랜드 로고 프리미티브(`@repo/ui`)

---

## 1. 정적 이미지 해상도 및 포맷 규격 (레티나 2x~3x 기준)

| 구분 | 화면 표시 크기 | 권장 원본 해상도 | 권장 용량 상한 | 포맷 |
| :--- | :--- | :--- | :---: | :--- |
| **견종 마스터 (`public/images/breeds/*.webp`)** | `48px ~ 160px` | **`400px × 400px`** (40종 풀셋) | **50KB 이하** | WebP (품질 80~85%) |
| **포인트샵 상품 · 상세 · 후기 · 일상 업로드 (`daily`)** | `170px ~ 440px` | **최대 폭 `1200px`** (서버 자동 리사이즈) | 자동 최적화 (장당 15MB 이하) | **WebP (품질 82%, `sharp` 강제 변환)** |
| **반려견 프로필 아바타 업로드 (`dogs`)** | `24px ~ 96px` | **`600px × 600px`** (1:1 자동 중앙 크롭) | **20~40KB** | **WebP (품질 84%, `sharp` `fit: "cover"`, `position: "attention"`)** |
| **1:1 Q&A 행동 영상 (`inquiries`)** | `16:9` 반응형 | 원본 MP4/MOV/WebM | **최대 50MB** | MP4 · MOV · WebM (초과 시 YouTube 링크) |
| **교육 강의 영상 (`lessons`, 관리자)** | `16:9` 반응형 | 원본 MP4/MOV/WebM | **최대 150MB** | MP4 · MOV · WebM (장시간은 YouTube 일부공개 권장) |
| **아이콘 / 뱃지** | `48px ~ 64px` | **`128px × 128px`** (1:1) | **15KB 이하** | WebP (투명 RGBA) |
| **배경 / 히어로 배너** | `440px` | **가로 `750px ~ 1080px`** | **100KB 이하** | WebP |

- **파일명 규칙**: 공백 및 한글/특수문자 사용 금지, 영문 소문자 + 하이픈(`-`) 사용.

---

## 2. `.env` 기반 업로드 저장소 & `sharp` WebP 자동 파이프라인

런타임 업로드 파일은 `public/`에 직접 쓰지 않고(운영 `next start` 빌드 후 404 방지 및 외부 볼륨 마운트 대응), 루트 `.env`로 경로를 제어합니다.

- **환경변수 (`.env` · `turbo.json` · `00_lib/env.ts`)**:
  - `UPLOAD_DIR`: 기본 `"./uploads"` (상대경로는 모노레포 루트 기준 해석, 운영 볼륨/NAS는 절대경로 지정 가능).
  - `UPLOAD_PUBLIC_BASE_URL`: 기본 `"/api/uploads"` (추후 CDN/S3 전환 시 베이스 URL만 변경).
- **업로드 엔드포인트 쿠키 격리 분리 (`00_lib/uploadStorage.ts`)**:
  - **관리자·훈련사 (`POST /admin/api/upload?category=products|editor|lessons|inquiries`)**: `WAGGLE_ADMIN_SESSION`(`path: "/admin"`) 검증 전용 (`TRAINER`는 `inquiries`만 허용).
  - **사용자 (`POST /api/upload?category=reviews|inquiries|dogs|daily`)**: `WAGGLE_APP_SESSION` 검증 전용.
- **보안 & 최적화 (전 카테고리 외부 노출 차단)**:
  - 상품·에디터·후기·아바타 이미지는 `sharp`로 강제 재인코딩하여 **확장자 위장 악성 파일 차단 + EXIF GPS 개인정보 제거**, `inquiries`(50MB)·`lessons`(150MB) 영상(`.mp4`/`.mov`/`.webm`)은 **Magic Bytes 시그니처(ISO BMFF `ftyp`/EBML)** 검증 후 저장합니다.
  - 서빙은 `GET /api/uploads/[...path]`(관리자·훈련사는 `GET /admin/api/uploads/[...path]`)에서 Path Traversal 검증 + **전 카테고리 로그인 세션 필수(401) + `Sec-Fetch-Site: cross-site` 핫링크 차단(403)** 후 **Node `ReadStream` 스트리밍 + HTTP `Range` (`206 Partial Content`, iOS Safari `<video>` 필수)** + `Cache-Control: private` + `X-Content-Type-Options: nosniff`로 응답합니다.
  - 소프트 삭제(`is_deleted = true`) 복원 시 이미지 깨짐을 막기 위해 디스크 파일은 즉시 `unlink`하지 않으며, DB 어느 행(소프트 삭제 및 `lesson_steps.video_url` · `daily_entries.photo_urls` · `daily_entry_stickers.photo_url` 포함)에서도 참조하지 않는 24시간+ 경과 고아 파일만 `POST /api/cron/cleanup-uploads` 크론으로 정리합니다.

---

## 3. 브랜드 로고 및 상품 이미지 미등록 폴백 표준

- **테마 연동 벡터 분리 (`@repo/ui`)**:
  - `WaggleMark` (`packages/ui/src/primitives/waggle-mark.tsx`, 정적 `public/images/logo_mark.svg`): 심볼 마크 전용 (`currentColor` + `fillOpacity` 투톤).
  - `WaggleWordmark` (`packages/ui/src/primitives/waggle-wordmark.tsx`, 원본 `public/images/logo_full.svg`): 가로 워드마크 (`useId` 투명 마스크).
  - `--color-brand` 또는 다크/라이트 테마 변경 시 별도 에셋 교체 없이 자동 연동.
- **상품 · 반려견 아바타 이미지 미등록 폴백**:
  - 포인트샵 리스트(`/app/shop`) · 상품 상세 스와이퍼(`/app/shop/products/[id]`)에서 등록 이미지가 0장인 상품 및 반려견 프로필 사진이 미등록된 아바타(`DogAvatar`)는 **`bg-brand` 배경 + 중앙 `<WaggleMark className="text-surface/95" />`**를 자동 렌더링합니다.
