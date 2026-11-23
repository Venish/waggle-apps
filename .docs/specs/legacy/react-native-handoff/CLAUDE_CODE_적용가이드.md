# 디자인 적용 작업 지시서 (Claude Code 실행용)

이 문서는 `mobile-app` (React Native 0.76 + NativeWind + react-navigation) 프로젝트에
디자인 시안을 적용하기 위한 **실행 지시서**입니다. 순서대로 그대로 수행하세요.

## 배경 (수정 불필요한 것들)
다음은 이미 시안과 일치하므로 **건드리지 마세요**:
- `src/theme/themes.ts` — pink/green/mint/darkblue 토큰이 시안과 hex까지 동일
- `src/theme/ThemeProvider.tsx`, `src/components/ui/theme-picker.tsx` — 그대로 동작
- 탭 순서(홈·산책·교육·미션·포인트샵), `Screen` 공통 헤더 구조

**실제 작업 = 이모지를 라인 픽토그램 SVG로 교체하는 것뿐.**

---

## STEP 1 — 의존성 설치
`react-native-svg`가 현재 미설치 상태입니다.
```bash
yarn add react-native-svg
cd ios && pod install && cd ..
```
> 설치 후 Metro 재시작(`yarn dev --reset-cache`) 필요.

---

## STEP 2 — 아이콘 컴포넌트 신규 생성
아래 내용으로 **새 파일** `src/components/ui/AppIcon.tsx` 를 생성하세요.

```tsx
import React from 'react';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';

export type IconName =
  | 'home' | 'walk' | 'education' | 'mission' | 'shop' | 'profile'
  | 'bell' | 'cart' | 'play' | 'pin' | 'clock' | 'flame' | 'camera' | 'checkCircle';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function AppIcon({ name, size = 22, color = '#1A1A1A', strokeWidth = 1.7 }: Props) {
  const c = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && (<>
        <Path d="M4 10.5 12 4l8 6.5" {...c} />
        <Path d="M6 9.3V19h12V9.3" {...c} />
        <Path d="M9.8 19v-4.2a2.2 2.2 0 0 1 4.4 0V19" {...c} />
      </>)}
      {name === 'walk' && (<>
        <Ellipse cx="6.5" cy="11" rx="1.5" ry="2" {...c} />
        <Ellipse cx="10" cy="7.8" rx="1.6" ry="2.2" {...c} />
        <Ellipse cx="14" cy="7.8" rx="1.6" ry="2.2" {...c} />
        <Ellipse cx="17.5" cy="11" rx="1.5" ry="2" {...c} />
        <Path d="M12 12.6c-2.4 0-4.3 1.9-4.3 3.8 0 1.5 1.4 2.1 4.3 2.1s4.3-.6 4.3-2.1c0-1.9-1.9-3.8-4.3-3.8Z" {...c} />
      </>)}
      {name === 'education' && (<>
        <Path d="M12 4 2.5 8.3 12 12.6l9.5-4.3L12 4Z" {...c} />
        <Path d="M6.5 10.5v4c0 1.5 2.7 3 5.5 3s5.5-1.5 5.5-3v-4" {...c} />
        <Path d="M21.5 8.3v5" {...c} />
      </>)}
      {name === 'mission' && (<>
        <Path d="M6 20.5V4.2" {...c} />
        <Path d="M6 5h11l-2.2 3.4L17 12H6" {...c} />
      </>)}
      {name === 'shop' && (<>
        <Path d="M6.5 8.5h11l-.9 11.2a1 1 0 0 1-1 .8H8.4a1 1 0 0 1-1-.8L6.5 8.5Z" {...c} />
        <Path d="M9.2 8.5a2.8 2.8 0 0 1 5.6 0" {...c} />
      </>)}
      {name === 'profile' && (<>
        <Circle cx="12" cy="8" r="3.4" {...c} />
        <Path d="M5.8 20a6.2 6.2 0 0 1 12.4 0" {...c} />
      </>)}
      {name === 'bell' && (<>
        <Path d="M6 9.5a6 6 0 0 1 12 0c0 4.2 1.6 5.5 1.6 5.5H4.4S6 13.7 6 9.5Z" {...c} />
        <Path d="M10 19a2 2 0 0 0 4 0" {...c} />
      </>)}
      {name === 'cart' && (<>
        <Circle cx="9" cy="20" r="1.4" {...c} />
        <Circle cx="17" cy="20" r="1.4" {...c} />
        <Path d="M3 4h2l2.2 11.2a1 1 0 0 0 1 .8h8.2a1 1 0 0 0 1-.8L20 7.5H6" {...c} />
      </>)}
      {name === 'play' && <Path d="M8 5.5v13l11-6.5-11-6.5Z" {...c} />}
      {name === 'pin' && (<>
        <Path d="M12 21s6-5.4 6-10.2A6 6 0 0 0 6 10.8C6 15.6 12 21 12 21Z" {...c} />
        <Circle cx="12" cy="10.6" r="2.2" {...c} />
      </>)}
      {name === 'clock' && (<>
        <Circle cx="12" cy="12" r="8" {...c} />
        <Path d="M12 8v4l2.5 2" {...c} />
      </>)}
      {name === 'flame' && (
        <Path d="M12 3s4 3.5 4 7a4 4 0 0 1-8 0c0-1.2.5-2.3 1-3 .2 1 .8 1.6 1.5 1.8C10 8 9.5 5 12 3Z" {...c} />
      )}
      {name === 'camera' && (<>
        <Path d="M4 8.5h3l1.3-2h7.4L17 8.5h3v10.5H4V8.5Z" {...c} />
        <Circle cx="12" cy="13" r="3.2" {...c} />
      </>)}
      {name === 'checkCircle' && (<>
        <Circle cx="12" cy="12" r="8.2" {...c} />
        <Path d="M8.5 12.2l2.4 2.4 4.6-5" {...c} />
      </>)}
    </Svg>
  );
}
```

---

## STEP 3 — 탭바 아이콘 교체
`src/app/navigation/tab-navigator.tsx` **전체를 아래로 교체**하세요.
(변경점: `Text`+emoji `TAB_ICONS` → `AppIcon`, 활성 탭에 `theme.soft` 알약 배경)

```tsx
import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeStack } from '@/app/navigation/stacks/home-stack';
import { EducationStack } from '@/app/navigation/stacks/education-stack';
import { WalkStack } from '@/app/navigation/stacks/walk-stack';
import { MissionStack } from '@/app/navigation/stacks/mission-stack';
import { ShopStack } from '@/app/navigation/stacks/shop-stack';
import type { RootTabParamList } from '@/app/navigation/types';
import { useTheme } from '@/theme';
import { AppIcon, type IconName } from '@/components/ui/AppIcon';

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<keyof RootTabParamList, IconName> = {
  HomeTab: 'home',
  WalkTab: 'walk',
  EducationTab: 'education',
  MissionTab: 'mission',
  ShopTab: 'shop',
};

export function MainTabNavigator() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused }) => (
          <View
            style={{
              width: 46,
              height: 30,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? theme.soft : 'transparent',
            }}
          >
            <AppIcon name={TAB_ICONS[route.name]} size={22} color={focused ? theme.accent : theme.textMuted} />
          </View>
        ),
      })}
    >
      <Tab.Screen component={HomeStack} name="HomeTab" options={{ title: '홈' }} />
      <Tab.Screen component={WalkStack} name="WalkTab" options={{ title: '산책' }} />
      <Tab.Screen component={EducationStack} name="EducationTab" options={{ title: '교육' }} />
      <Tab.Screen component={MissionStack} name="MissionTab" options={{ title: '미션' }} />
      <Tab.Screen component={ShopStack} name="ShopTab" options={{ title: '포인트샵' }} />
    </Tab.Navigator>
  );
}
```

---

## STEP 4 — 공통 헤더 아이콘 교체
`src/components/ui/screen.tsx` 를 두 군데 수정하세요.

### 4-1. import 추가 (파일 상단)
```tsx
import { AppIcon, type IconName } from '@/components/ui/AppIcon';
```

### 4-2. 헤더 우측 호출부 교체
기존:
```tsx
        {headerRight === 'none' ? null : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <HeaderIcon
              glyph={headerRight === 'cart' ? '🛒' : '🔔'}
              onPress={() =>
                navigation.navigate((headerRight === 'cart' ? 'Cart' : 'Notifications') as never)
              }
            />
            <HeaderIcon glyph="👤" onPress={() => navigation.navigate('MyPage' as never)} />
          </View>
        )}
```
교체 후:
```tsx
        {headerRight === 'none' ? null : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <HeaderIcon
              icon={headerRight === 'cart' ? 'cart' : 'bell'}
              badge={headerRight !== 'cart'}
              onPress={() =>
                navigation.navigate((headerRight === 'cart' ? 'Cart' : 'Notifications') as never)
              }
            />
            <HeaderIcon icon="profile" onPress={() => navigation.navigate('MyPage' as never)} />
          </View>
        )}
```

### 4-3. `HeaderIcon` 함수 정의 교체
기존의 `function HeaderIcon({ glyph, onPress }) { ... }` 전체를 아래로 교체:
```tsx
function HeaderIcon({
  icon,
  badge,
  onPress,
}: {
  icon: IconName;
  badge?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      hitSlop={6}
      onPress={onPress}
      style={{
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: theme.soft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppIcon name={icon} size={21} color={theme.accent} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: 9,
            right: 10,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#FF4D6A',
            borderWidth: 1.5,
            borderColor: theme.soft,
          }}
        />
      ) : null}
    </Pressable>
  );
}
```

---

## STEP 5 — (선택) 화면 본문 이모지 교체
통일감을 위해 각 화면 본문의 이모지도 `AppIcon`으로 바꾸는 것을 권장합니다.
대표 매핑 (`src/features/home/screens/HomeScreen.tsx` `TodoRow` 등):

| 기존 이모지 | AppIcon name | 비고 |
|---|---|---|
| 🐾 | `walk` | 산책 |
| 🎓 | `education` | 교육 |
| ✅ | `checkCircle` | `color={theme.success}` 고정 |
| ▶/재생 | `play` | 버튼 내부는 `color="#fff"` |
| 📍 GPS | `pin` | |
| ⏱ 시간 | `clock` | |
| 🔥 칼로리 | `flame` | |
| 📷 사진인증 | `camera` | |
| 🏆 미션 | `mission` | |
| 🛍 샵 | `shop` | |

예시 (`TodoRow` 의 소프트 원형 안 `<Text>{icon}</Text>` 대체):
```tsx
<AppIcon name="walk" size={18} color={theme.accent} />
```
`tab-navigator.tsx`의 `MonthlyCalendar` 마커 이모지(🐾🎓💉🏆💩)는 정보 밀도가 낮아 그대로 두어도 무방합니다.

---

## STEP 6 — 검증 체크리스트
- [ ] `yarn typecheck` 통과 (AppIcon prop 타입)
- [ ] iOS/Android 실행 후 탭바 5개 아이콘 라인 픽토그램으로 표시
- [ ] 활성 탭에 soft 알약 배경 + accent 색
- [ ] 헤더 우측 알림(빨간 점)·마이 아이콘 표시, 포인트샵 화면은 장바구니
- [ ] 설정에서 테마(핑크/연두/민트/다크블루) 변경 시 아이콘 색이 즉시 따라감
- [ ] `react-native-svg` pod 설치 확인 (iOS 빌드 에러 없을 것)

## 커밋 제안
```
feat(ui): 라인 픽토그램 아이콘 시스템 도입 (AppIcon)
- react-native-svg 추가
- 탭바/공통헤더 이모지 → 테마 대응 SVG 픽토그램 교체
- 활성 탭 soft 알약 + accent 스타일 적용
```
