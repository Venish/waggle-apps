// src/components/ui/AppIcon.tsx
// 디자인 시안의 라인 픽토그램 세트를 react-native-svg로 포팅.
// 모든 아이콘: viewBox 0 0 24 24 · stroke 기반 · currentColor(=color prop) · 라운드 조인.
//
// 설치: yarn add react-native-svg && (cd ios && pod install)
//
// 사용:
//   <AppIcon name="home" size={22} color={theme.accent} />
//   strokeWidth 기본 1.7 (디자인 값). 채우기 없음.

import React from 'react';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';

export type IconName =
  | 'home'
  | 'walk'      // 발바닥 (산책)
  | 'education' // 학사모 (교육)
  | 'mission'   // 깃발 (미션)
  | 'shop'      // 쇼핑백
  | 'profile'   // 사람 (마이)
  | 'bell'      // 알림
  | 'cart'      // 장바구니
  | 'play'
  | 'pin'       // GPS 핀
  | 'clock'
  | 'flame'     // 칼로리
  | 'camera'
  | 'checkCircle';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function AppIcon({ name, size = 22, color = '#1A1A1A', strokeWidth = 1.7 }: Props) {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && (
        <>
          <Path d="M4 10.5 12 4l8 6.5" {...common} />
          <Path d="M6 9.3V19h12V9.3" {...common} />
          <Path d="M9.8 19v-4.2a2.2 2.2 0 0 1 4.4 0V19" {...common} />
        </>
      )}
      {name === 'walk' && (
        <>
          <Ellipse cx="6.5" cy="11" rx="1.5" ry="2" {...common} />
          <Ellipse cx="10" cy="7.8" rx="1.6" ry="2.2" {...common} />
          <Ellipse cx="14" cy="7.8" rx="1.6" ry="2.2" {...common} />
          <Ellipse cx="17.5" cy="11" rx="1.5" ry="2" {...common} />
          <Path
            d="M12 12.6c-2.4 0-4.3 1.9-4.3 3.8 0 1.5 1.4 2.1 4.3 2.1s4.3-.6 4.3-2.1c0-1.9-1.9-3.8-4.3-3.8Z"
            {...common}
          />
        </>
      )}
      {name === 'education' && (
        <>
          <Path d="M12 4 2.5 8.3 12 12.6l9.5-4.3L12 4Z" {...common} />
          <Path d="M6.5 10.5v4c0 1.5 2.7 3 5.5 3s5.5-1.5 5.5-3v-4" {...common} />
          <Path d="M21.5 8.3v5" {...common} />
        </>
      )}
      {name === 'mission' && (
        <>
          <Path d="M6 20.5V4.2" {...common} />
          <Path d="M6 5h11l-2.2 3.4L17 12H6" {...common} />
        </>
      )}
      {name === 'shop' && (
        <>
          <Path d="M6.5 8.5h11l-.9 11.2a1 1 0 0 1-1 .8H8.4a1 1 0 0 1-1-.8L6.5 8.5Z" {...common} />
          <Path d="M9.2 8.5a2.8 2.8 0 0 1 5.6 0" {...common} />
        </>
      )}
      {name === 'profile' && (
        <>
          <Circle cx="12" cy="8" r="3.4" {...common} />
          <Path d="M5.8 20a6.2 6.2 0 0 1 12.4 0" {...common} />
        </>
      )}
      {name === 'bell' && (
        <>
          <Path d="M6 9.5a6 6 0 0 1 12 0c0 4.2 1.6 5.5 1.6 5.5H4.4S6 13.7 6 9.5Z" {...common} />
          <Path d="M10 19a2 2 0 0 0 4 0" {...common} />
        </>
      )}
      {name === 'cart' && (
        <>
          <Circle cx="9" cy="20" r="1.4" {...common} />
          <Circle cx="17" cy="20" r="1.4" {...common} />
          <Path d="M3 4h2l2.2 11.2a1 1 0 0 0 1 .8h8.2a1 1 0 0 0 1-.8L20 7.5H6" {...common} />
        </>
      )}
      {name === 'play' && <Path d="M8 5.5v13l11-6.5-11-6.5Z" {...common} />}
      {name === 'pin' && (
        <>
          <Path d="M12 21s6-5.4 6-10.2A6 6 0 0 0 6 10.8C6 15.6 12 21 12 21Z" {...common} />
          <Circle cx="12" cy="10.6" r="2.2" {...common} />
        </>
      )}
      {name === 'clock' && (
        <>
          <Circle cx="12" cy="12" r="8" {...common} />
          <Path d="M12 8v4l2.5 2" {...common} />
        </>
      )}
      {name === 'flame' && (
        <Path
          d="M12 3s4 3.5 4 7a4 4 0 0 1-8 0c0-1.2.5-2.3 1-3 .2 1 .8 1.6 1.5 1.8C10 8 9.5 5 12 3Z"
          {...common}
        />
      )}
      {name === 'camera' && (
        <>
          <Path d="M4 8.5h3l1.3-2h7.4L17 8.5h3v10.5H4V8.5Z" {...common} />
          <Circle cx="12" cy="13" r="3.2" {...common} />
        </>
      )}
      {name === 'checkCircle' && (
        <>
          <Circle cx="12" cy="12" r="8.2" {...common} />
          <Path d="M8.5 12.2l2.4 2.4 4.6-5" {...common} />
        </>
      )}
    </Svg>
  );
}
