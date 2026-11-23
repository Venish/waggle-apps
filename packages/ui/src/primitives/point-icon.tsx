import type { SVGProps } from "react";

export interface PointIconProps extends SVGProps<SVGSVGElement> {
  /** "filled": 원형 채움 + 투명 P 컷아웃 (기본) | "outline": Lucide 라인 아이콘과 동일한 선형 원 + P */
  variant?: "filled" | "outline";
  strokeWidth?: number;
}

/**
 * 와글 공용 포인트(P) 아이콘 프리미티브 (currentColor 테마 자동 연동)
 */
export function PointIcon({
  variant = "filled",
  strokeWidth = 2,
  className = "size-4",
  ...rest
}: PointIconProps) {
  if (variant === "outline") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
        {...rest}
      >
        <circle cx="12" cy="12" r="9.5" />
        <path d="M9.75 16.5V7.5h3.35a2.65 2.65 0 0 1 0 5.3H9.75" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 1.5A10.5 10.5 0 1 0 12 22.5A10.5 10.5 0 1 0 12 1.5ZM8.7 6.8H13.1C15.1 6.8 16.4 8 16.4 10C16.4 12 15.1 13.3 13.1 13.3H11V17.4H8.7V6.8ZM11 8.8V11.3H12.9C13.7 11.3 14.1 10.8 14.1 10.05C14.1 9.3 13.7 8.8 12.9 8.8H11Z"
      />
    </svg>
  );
}
