# 🖼️ 이미지 에셋 제작 및 렌더링 표준 가이드 (Image Asset Guide)

> **문서 상태:** 활성 (Active SSOT)  
> **적용 범위:** 와글(Waggle) 정적 이미지 에셋, 아이콘, 배너 및 `<SafeImage />` 컴포넌트

---

## 1. 해상도 및 포맷 규격 (레티나 2x~3x 기준)

모바일 기기의 고해상도 화면에서 선명하게 표시되면서도 GPU 텍스처 메모리 낭비와 스와이프 버벅임을 방지하기 위해 아래 규격을 준수합니다.

| 구분 | 화면 표시 크기 | **권장 원본 해상도** | 권장 용량 상한선 | 포맷 |
|---|---|---|---|---|
| **카드 썸네일 / 포스터** | `160px × 220px` 내외 | **`420px × 590px`** | **50KB 이하** | WebP (품질 80~85%) |
| **아이콘 / 뱃지** | `48px ~ 64px` | **`128px × 128px`** (1:1) | **15KB 이하** | WebP (투명 RGBA) |
| **배경 / 히어로 배너** | 전체 화면 너비 (430px) | **가로 `750px ~ 1080px`** | **100KB 이하** | WebP |

- **파일명 규칙**: 공백 및 한글/특수문자 사용 지양, 영문 소문자 + 하이픈(`-`) 또는 언더스코어(`_`) 사용.

---

## 2. `<SafeImage />` 공통 컴포넌트 사용 표준

일반 `<img>` 태그 대신 `@/components/ui/SafeImage`를 사용하여 이미지 깨짐 방지(Graceful Fallback) 및 모바일 고스트 드래그 차단을 보장합니다.

```tsx
import { SafeImage } from "@/components/ui/SafeImage";

<div className="relative w-full h-48 rounded-2xl overflow-hidden">
  <SafeImage
    src={item.thumbnailUrl}
    alt={item.title}
    fill
    priority={false}
  />
</div>
```

### 핵심 내장 기능
1. **Graceful Fallback**: 404 또는 네트워크 단절 시 엑스박스 대신 단정한 스켈레톤/플레이스홀더 표출.
2. **모바일 스와이프 안전**: `draggable={false}` 및 `select-none` 기본 적용으로 모달 스와이프 중 이미지 드래그 간섭 차단.
