# 디자인 → mobile-app 적용 가이드

좋은 소식: 이 프로젝트는 시안과 **이미 거의 일치**합니다.

- `src/theme/themes.ts` 의 pink / green / mint / darkblue 토큰 = 시안 색상값과 **hex까지 동일**
- `useTheme()`, `theme.accent / accentDark / soft / gradient / shadow`, `glowShadow()` 모두 존재
- `ThemePicker`, `Screen` 공통 헤더(🔔+👤, 샵은 🛒), 탭 순서(홈·산책·교육·미션·샵)까지 시안과 동일

즉 색상 테마 시스템은 **손댈 필요 없음**. 유일한 갭은 **이모지 → 라인 픽토그램 SVG** 교체입니다.

---

## 적용 순서 (3단계)

### 1. react-native-svg 설치 (현재 미설치)
```bash
yarn add react-native-svg
cd ios && pod install && cd ..
```

### 2. 아이콘 컴포넌트 추가
`AppIcon.tsx` → `src/components/ui/AppIcon.tsx` 로 복사.
시안의 모든 라인 픽토그램(home / walk / education / mission / shop / profile / bell / cart / play / pin / clock / flame / camera / checkCircle)이 들어 있고 `color` prop 으로 테마 색을 받습니다.

### 3. 두 파일에서 이모지만 교체
- `tab-navigator.tsx` → 이 폴더의 버전으로 교체
  (활성 탭에 `theme.soft` 알약 배경 + `theme.accent` 아이콘 적용 — 시안과 동일)
- `screen.tsx` 의 `HeaderIcon` → `screen-header.tsx` 참고해서 교체
  (🔔→`bell`+빨간 점, 👤→`profile`, 🛒→`cart`, 모두 soft 원형 + accent)

---

## 화면 본문 아이콘
`HomeScreen` 등에서 쓰는 이모지(🐾 🎓 ✅ 등)도 같은 방식으로 바꾸면 통일됩니다:

```tsx
// 예: TodoRow 의 소프트 원형 안
<AppIcon name="walk" size={18} color={theme.accent} />

// 재생 버튼
<AppIcon name="play" size={19} color="#fff" />

// 완료 체크 (초록 고정)
<AppIcon name="checkCircle" size={20} color={theme.success} />
```

`AppIcon` 은 stroke 기반이라 `color` 만 넘기면 어떤 테마에서도 자동으로 맞습니다.
새 픽토그램이 필요하면 `IconName` union 에 이름 추가 후 `<Path>` 한 줄만 넣으면 됩니다.
