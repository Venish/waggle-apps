// screen.tsx 안의 HeaderIcon 을 아래로 교체하고, 헤더 우측 호출부만 살짝 수정하면 됩니다.
// (Screen 컴포넌트의 나머지 구조는 그대로 두세요.)

import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { AppIcon, type IconName } from '@/components/ui/AppIcon';

// ── 헤더 우측 호출부: 기존 emoji glyph 대신 icon 이름을 넘깁니다 ──
//
//   {headerRight === 'none' ? null : (
//     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
//       <HeaderIcon
//         icon={headerRight === 'cart' ? 'cart' : 'bell'}
//         badge={headerRight !== 'cart'}   // 알림에는 빨간 점
//         onPress={() =>
//           navigation.navigate((headerRight === 'cart' ? 'Cart' : 'Notifications') as never)
//         }
//       />
//       <HeaderIcon icon="profile" onPress={() => navigation.navigate('MyPage' as never)} />
//     </View>
//   )}

// soft 원형 배경 + accent 라인 아이콘 (디자인 시안 상단 알림/마이와 동일)
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
