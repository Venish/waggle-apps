import type { SVGProps } from "react";

export type PawIconProps = SVGProps<SVGSVGElement>;

/**
 * 와글 공용 강아지 발바닥(솔리드) 아이콘 프리미티브 (currentColor 테마 자동 연동)
 * - 12~14px 소형 배지에서도 실루엣이 또렷하게 보이도록 대칭 4발가락 + 중앙 패드 채움형으로 설계
 */
export function PawIcon({ className = "size-4", ...rest }: PawIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="5 2 30 30"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <ellipse cx="10" cy="15" rx="3.5" ry="4" />
      <ellipse cx="16" cy="8.5" rx="3.5" ry="4.5" />
      <ellipse cx="24" cy="8.5" rx="3.5" ry="4.5" />
      <ellipse cx="30" cy="15" rx="3.5" ry="4" />
      <ellipse cx="20" cy="21" rx="6" ry="7" />
      <circle cx="15" cy="25" r="5" />
      <circle cx="25" cy="25" r="5" />
    </svg>
  );
}
