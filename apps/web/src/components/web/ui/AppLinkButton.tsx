import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { getMobileForwardTransitionTypes } from "@/00_lib/mobileRoutePresentation";
import {
  appButtonClass,
  type AppButtonSize,
  type AppButtonVariant,
} from "./buttonStyles";

interface AppLinkButtonProps extends Omit<ComponentProps<typeof Link>, "className"> {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Server Component 호환 공용 링크 버튼 (<Link> + AppButton 동일 스타일 SSOT + ViewTransition 자동 주입)
 */
export function AppLinkButton({
  href,
  transitionTypes,
  variant = "primary",
  size = "lg",
  fullWidth = false,
  className,
  children,
  ...rest
}: AppLinkButtonProps) {
  const resolvedTypes =
    transitionTypes ??
    (typeof href === "string" ? getMobileForwardTransitionTypes(href) : undefined);

  return (
    <Link
      href={href}
      transitionTypes={resolvedTypes}
      className={appButtonClass({ variant, size, fullWidth, className })}
      {...rest}
    >
      {children}
    </Link>
  );
}
