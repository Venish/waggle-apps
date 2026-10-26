# 컬러 테마 디자인 적용 가이드

> 대상 프로젝트: `apps/mobile-app` (React Native)
> 원본 시안: `포인트 산책 앱 - 컬러테마` (옵션 A — 4가지 컬러 테마)
> 문서 위치: `documents/design-theme-guide.md`

## 1. 개요

시안의 핵심 컨셉은 **"레이아웃·구성은 고정하고 메인 컬러만 토큰으로 교체"** 하는 것이다.
사용자는 설정 화면에서 4가지 테마(핑크·연두·민트·다크블루) 중 하나를 선택하고, 선택은 앱 재시작 후에도 유지된다.

이를 위해 다음 3가지를 구현한다.

1. **테마 토큰 정의** — 시안의 CSS 변수를 JS 객체로 1:1 이관
2. **ThemeProvider** — React Context + AsyncStorage 영속화
3. **컴포넌트 적용 패턴** — `useTheme()` 훅으로 토큰 소비

## 2. 디렉터리 구조

```
apps/mobile-app/
└── src/
    └── theme/
        ├── themes.js          # 토큰 정의 (섹션 3)
        ├── ThemeProvider.js   # Context + 영속화 (섹션 4)
        └── index.js           # re-export
```

`index.js`:

```js
export { THEMES, BASE, THEME_ORDER } from './themes';
export { ThemeProvider, useTheme } from './ThemeProvider';
```

## 3. 테마 토큰 (`themes.js`)

시안 HTML의 CSS 변수(`--accent`, `--accent-dark`, `--soft`, `--g1`/`--g2`, `--shadow`, `--ring`)를 그대로 옮긴 값이다. **임의로 색상값을 수정하지 말 것** — 디자인 확정값이다.

```js
// src/theme/themes.js

export const THEMES = {
  pink: {
    key: 'pink',
    label: '핑크',
    accent: '#FF6B9D',
    accentDark: '#E84A7F',
    soft: '#FFEAF1',
    gradient: ['#FF7FA8', '#F85C92'],
    shadow: 'rgba(255,107,157,0.32)',
    ring: 'rgba(255,107,157,0.45)',
  },
  green: {
    key: 'green',
    label: '연두',
    accent: '#7BBF3F',
    accentDark: '#5FA02B',
    soft: '#EEF6E1',
    gradient: ['#93D154', '#6FB332'],
    shadow: 'rgba(123,191,63,0.30)',
    ring: 'rgba(123,191,63,0.45)',
  },
  mint: {
    key: 'mint',
    label: '민트',
    accent: '#1FB8A6',
    accentDark: '#0E9787',
    soft: '#DFF5F1',
    gradient: ['#38C9B8', '#14A695'],
    shadow: 'rgba(31,184,166,0.30)',
    ring: 'rgba(31,184,166,0.45)',
  },
  darkblue: {
    key: 'darkblue',
    label: '다크블루',
    accent: '#34508F',
    accentDark: '#25396B',
    soft: '#E9EDF8',
    gradient: ['#4664A8', '#2C4680'],
    shadow: 'rgba(52,80,143,0.30)',
    ring: 'rgba(52,80,143,0.45)',
  },
};

// 테마와 무관한 공통 토큰
export const BASE = {
  bg: '#EAE8EE',       // 화면 배경
  text: '#1A1A1A',     // 본문 텍스트
  textSub: '#6A6A72',  // 보조 텍스트
  textMuted: '#8A8A90',// 라벨/비활성
  card: '#FFFFFF',     // 카드 배경
  border: '#ECECEF',   // 카드 테두리
};

// 설정 화면 스와치 노출 순서
export const THEME_ORDER = ['pink', 'green', 'mint', 'darkblue'];
```

### 토큰 → 용도 매핑

| 토큰 | 시안 변수 | 용도 |
|---|---|---|
| `accent` | `--accent` | 포인트 컬러: 버튼, 활성 탭, 아이콘, 강조 텍스트 |
| `accentDark` | `--accent-dark` | pressed 상태, 진한 강조 |
| `soft` | `--soft` | 연한 배경: 뱃지, 칩, 하이라이트 카드 배경 |
| `gradient` | `--g1` → `--g2` | 주요 CTA 버튼, 히어로 카드 그라데이션 |
| `shadow` | `--shadow` | 컬러 글로우 그림자 (섹션 7 참고) |
| `ring` | `--ring` | 선택/포커스 테두리 |

## 4. ThemeProvider (`ThemeProvider.js`)

의존성 설치:

```bash
pnpm --filter mobile-app add @react-native-async-storage/async-storage
# 그라데이션 (Expo면 expo-linear-gradient, bare RN이면 react-native-linear-gradient)
pnpm --filter mobile-app add react-native-linear-gradient
```

```jsx
// src/theme/ThemeProvider.js
import React, {
  createContext, useContext, useEffect, useMemo, useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEMES, BASE } from './themes';

const STORAGE_KEY = '@app_theme';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState('pink'); // 기본 테마 = 핑크

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && THEMES[saved]) setThemeKey(saved);
    });
  }, []);

  const setTheme = (key) => {
    if (!THEMES[key]) return;
    setThemeKey(key);
    AsyncStorage.setItem(STORAGE_KEY, key);
  };

  const value = useMemo(
    () => ({ theme: { ...BASE, ...THEMES[themeKey] }, themeKey, setTheme }),
    [themeKey],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme는 ThemeProvider 안에서만 사용하세요.');
  return ctx;
}
```

앱 루트에 연결 (`App.tsx` 또는 엔트리 파일):

```jsx
import { ThemeProvider } from './src/theme';

export default function App() {
  return (
    <ThemeProvider>
      {/* NavigationContainer 등 기존 트리 */}
    </ThemeProvider>
  );
}
```

## 5. 컴포넌트 적용 패턴

### 원칙

- **하드코딩된 색상값 금지.** 화면/컴포넌트에서 `#FF6B9D` 같은 리터럴을 직접 쓰지 않는다. 반드시 `useTheme()`의 토큰을 사용한다.
- `StyleSheet.create`는 정적이므로, **테마 의존 스타일은 인라인 또는 스타일 팩토리 함수**로 처리한다. 테마 무관 스타일(레이아웃, 여백)은 StyleSheet에 유지해도 된다.

### 패턴 A — 인라인 병합 (간단한 경우)

```jsx
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

function Badge({ label }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: theme.soft }]}>
      <Text style={[styles.badgeText, { color: theme.accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999 },
  badgeText: { fontSize: 13, fontWeight: '700' },
});
```

### 패턴 B — 스타일 팩토리 (스타일이 많은 화면)

```jsx
const makeStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  cta: { backgroundColor: theme.accent, borderRadius: 16 },
});

function HomeScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  // ...
}
```

### 그라데이션 CTA 버튼

```jsx
import LinearGradient from 'react-native-linear-gradient';

function PrimaryButton({ title, onPress }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress}>
      <LinearGradient
        colors={theme.gradient}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
          {title}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}
```

## 6. 설정 화면 — 테마 선택기

시안의 스와치 UI: 46px 원형 스와치, 선택 시 `흰색 3px 간격 + accent 2px 링` 이중 테두리, 하단 라벨은 선택 시 accent 색·bold.

```jsx
import { View, Text, Pressable } from 'react-native';
import { THEMES, THEME_ORDER, useTheme } from '../theme';

export function ThemePicker() {
  const { themeKey, setTheme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 16 }}>
      {THEME_ORDER.map((k) => {
        const t = THEMES[k];
        const active = k === themeKey;
        return (
          <Pressable key={k} onPress={() => setTheme(k)}
            style={{ alignItems: 'center', gap: 7 }}>
            <View style={{
              padding: active ? 2 : 0, borderRadius: 28,
              backgroundColor: active ? t.accent : 'transparent',
            }}>
              <View style={{
                padding: active ? 3 : 0, borderRadius: 26,
                backgroundColor: active ? '#fff' : 'transparent',
              }}>
                <View style={{
                  width: 46, height: 46, borderRadius: 23,
                  backgroundColor: t.accent,
                }} />
              </View>
            </View>
            <Text style={{
              fontSize: 12,
              fontWeight: active ? '700' : '600',
              color: active ? t.accent : '#8A8A90',
            }}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

## 7. 안드로이드 컬러 그림자 주의사항

시안은 accent 색이 번지는 컬러 글로우 그림자(`--shadow`)를 사용한다.
그러나 **Android의 `elevation`은 회색 그림자만 렌더링**하고, `shadowColor/shadowOpacity/shadowRadius`는 iOS 전용이다. (Android API 28+에서 `shadowColor`가 elevation에 일부 반영되지만 시안 수준의 글로우는 안 나온다.)

대응 방법 (권장 순):

1. **`react-native-shadow-2`** 라이브러리 사용 — SVG 기반이라 색상 그림자 재현 가능.

   ```jsx
   import { Shadow } from 'react-native-shadow-2';

   <Shadow distance={12} startColor={theme.shadow} offset={[0, 6]}>
     <LinearGradient colors={theme.gradient} style={{ borderRadius: 16 }}>
       {/* ... */}
     </LinearGradient>
   </Shadow>
   ```

2. **글로우 레이어 기법** — 버튼 뒤에 `theme.shadow` 색 View를 blur 없이 깔고 살짝 오프셋. 라이브러리 추가가 부담될 때.
3. **타협** — Android에서는 `elevation: 6` 회색 그림자로 대체. 시안과 차이가 나므로 디자이너 확인 필요.

## 8. 적용 체크리스트

- [ ] `src/theme/` 3개 파일 생성 (`themes.js`, `ThemeProvider.js`, `index.js`)
- [ ] `@react-native-async-storage/async-storage`, `react-native-linear-gradient` 설치
- [ ] 앱 루트를 `<ThemeProvider>`로 래핑
- [ ] 설정 화면에 `ThemePicker` 추가
- [ ] 기존 화면의 하드코딩 색상 → 토큰 치환 (grep으로 `#` 리터럴 검색)
- [ ] 주요 CTA를 `gradient` 기반 `PrimaryButton`으로 교체
- [ ] Android 실기기에서 4개 테마 전환 + 앱 재시작 후 유지 확인
- [ ] Android 그림자 렌더링 확인 (섹션 7)

## 9. 미확정 사항

원본 시안 파일은 발표용 export로, 메인·교육·미션 3개 화면의 **실제 레이아웃 마크업은 외부 컴포넌트(`dc-import`)로 참조되어 있어 이 문서에 포함되지 않았다.**
해당 화면들의 픽셀 단위 레이아웃 작업 시에는 디자인 툴 원본 또는 화면별 스크린샷을 기준으로 진행할 것. 이 문서는 컬러 토큰 시스템과 적용 패턴까지를 확정 범위로 한다.
