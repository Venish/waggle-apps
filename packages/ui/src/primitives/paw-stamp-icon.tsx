import type { SVGProps } from "react";

export interface PawStampIconProps extends SVGProps<SVGSVGElement> {
  /** 도장 외곽 원 테두리 투명도 (기본 0.85) */
  ringOpacity?: number;
  /** 중앙 몰랑 발바닥 채움 색상 (기본 "currentColor", 고명암비 민트 등 별도 지정 가능) */
  pawFill?: string;
  /** 중앙 몰랑 발바닥 채움 투명도 (기본 1) */
  pawOpacity?: number;
}

/**
 * 와글 공용 강아지 발바닥 도장 SVG 프리미티브 (currentColor 테마 자동 연동)
 * - 외곽 실선 원 + 안쪽 20등분 둥근 점선 원 이중 도장 테두리 + -12deg 기울어진 몰랑 발바닥 조합
 * - 캘린더 기록일 / 산책 완료 도장 / 출석 스탬프 등 공용 사용
 */
export function PawStampIcon({
  ringOpacity = 1,
  pawFill = "currentColor",
  pawOpacity = 1,
  className = "size-11",
  ...rest
}: PawStampIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 44 44"
      fill="none"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {/* 외곽 실선 도장 프레임 */}
      <circle
        cx="22"
        cy="22"
        r="20.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity={ringOpacity}
      />
      {/* 안쪽 20등분 둥근 점선 링 */}
      <circle
        cx="22"
        cy="22"
        r="17.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2.4 3.129"
        strokeLinecap="round"
        strokeOpacity={ringOpacity}
      />
      {/* 중앙 기울어진 발바닥 도장 */}
      <g
        fill={pawFill}
        fillOpacity={pawOpacity}
        transform="translate(22 22) rotate(-12) scale(0.84) translate(-20 -17)"
      >
        <ellipse cx="10" cy="15" rx="3.5" ry="4" />
        <ellipse cx="16" cy="8.5" rx="3.5" ry="4.5" />
        <ellipse cx="24" cy="8.5" rx="3.5" ry="4.5" />
        <ellipse cx="30" cy="15" rx="3.5" ry="4" />
        <ellipse cx="20" cy="21" rx="6" ry="7" />
        <circle cx="15" cy="25" r="5" />
        <circle cx="25" cy="25" r="5" />
      </g>
    </svg>
  );
}
