import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { getMobileForwardTransitionTypes } from "@/00_lib/mobileRoutePresentation";

export interface AppLinkProps extends ComponentProps<typeof Link> {
  children: ReactNode;
}

/**
 * Server/Client 공용 네이티브 전환 링크
 * - href가 /app/* SUB_PUSH 또는 MODAL_PAGE인 경우 ViewTransition 방향 타입을 자동 주입한다.
 * - ROOT_TAB · 동일 페이지 필터 링크 등은 transitionTypes를 생략해 기본 동작을 유지한다.
 */
export function AppLink({ href, transitionTypes, children, ...rest }: AppLinkProps) {
  const resolvedTypes =
    transitionTypes ??
    (typeof href === "string" ? getMobileForwardTransitionTypes(href) : undefined);

  return (
    <Link href={href} transitionTypes={resolvedTypes} {...rest}>
      {children}
    </Link>
  );
}
