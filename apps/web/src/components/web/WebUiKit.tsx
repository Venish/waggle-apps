import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn, WaggleMark } from "@repo/ui";
import { AppLinkButton } from "@/components/web/ui";

export { SubPageHeader, type SubPageHeaderProps } from "@/components/web/SubPageHeader";

const DOG_AVATAR_SIZE = {
  xs: "size-6",
  sm: "size-9",
  md: "size-12",
  lg: "size-16",
  xl: "size-24",
} as const;

/**
 * 반려견 아바타 (전 화면 .waggle-squircle 슈퍼타원 기본 통일)
 * - 등록된 사진이 없으면 브랜드 그린 배경 + WaggleMark(logo_mark) 폴백을 표시한다.
 */
export function DogAvatar({
  src,
  name,
  size = "md",
  shape = "squircle",
  className,
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof DOG_AVATAR_SIZE;
  shape?: "circle" | "squircle";
  className?: string;
}) {
  const isSquircle = shape === "squircle";
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
        isSquircle ? "waggle-squircle" : "rounded-full",
        src
          ? isSquircle
            ? "bg-surface-subtle"
            : "bg-surface-subtle ring-1 ring-ink/[0.08]"
          : "bg-brand text-surface/95",
        DOG_AVATAR_SIZE[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${name} 프로필 사진`} className="size-full object-cover" />
      ) : (
        <WaggleMark className="w-[54%]" />
      )}
    </span>
  );
}

/**
 * (mobile) 공용 하단 고정 CTA 바
 * - 440px 모바일 프레임 중앙 정렬 + iOS 노치/홈 인디케이터(pb-safe-bottom) 단일 대응
 * - 사용하는 페이지 본문 래퍼에는 pb-24 여백을 함께 지정해 마지막 콘텐츠가 가리지 않게 한다.
 */
export function SubPageBottomBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-1/2 z-20 w-full max-w-app -translate-x-1/2 bg-surface/95 px-4 pt-3 backdrop-blur-md pb-safe-bottom",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function EmptyStateCard({
  title,
  description,
  ctaLabel,
  ctaHref,
  icon,
  mode = "page",
  tint,
  className,
}: {
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  icon?: ReactNode;
  /** "page": 남은 뷰포트 세로 중앙(광학 중앙) 정렬 | "section": 카드·탭 내부 컴팩트 빈 상태 */
  mode?: "page" | "section";
  tint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center px-4 text-center text-ink",
        mode === "page" ? "pb-12 pt-6" : "min-h-48 py-10",
        tint,
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-subtle text-ink-muted">
        {icon ?? <Inbox className="size-5.5" strokeWidth={1.7} />}
      </div>
      <h2 className="mt-4 text-base font-bold text-ink">{title}</h2>
      {description && (
        <p className="mt-1.5 max-w-64 text-sm leading-relaxed text-ink-muted">{description}</p>
      )}
      {ctaLabel && ctaHref && (
        <AppLinkButton href={ctaHref} variant="primary" size="md" className="mt-5 px-5">
          {ctaLabel}
        </AppLinkButton>
      )}
    </div>
  );
}
