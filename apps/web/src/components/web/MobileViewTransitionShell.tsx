"use client";

import { ViewTransition, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getMobileRoutePresentation } from "@/00_lib/mobileRoutePresentation";

/**
 * (mobile) 네이티브 ViewTransition 래퍼
 * - 5대 ROOT_TAB 간 이동 시 key("root-tabs")를 유지해 BottomNavBar 슬라이딩 캡슐이 리마운트되지 않도록 보호
 * - SUB_PUSH(←): 좌우 패럴랙스 Push/Pop / MODAL_PAGE(×): 담백 상하 덮기·내리기
 */
export function MobileViewTransitionShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { mode } = getMobileRoutePresentation(pathname);
  const transitionKey = mode === "ROOT_TAB" ? "root-tabs" : pathname;

  return (
    <ViewTransition
      key={transitionKey}
      enter={{
        "waggle-push-forward": "waggle-vt-push-enter",
        "waggle-push-back": "waggle-vt-pop-enter",
        "waggle-modal-up": "waggle-vt-modal-enter",
        "waggle-modal-down": "waggle-vt-modal-close-enter",
        default: "none",
      }}
      exit={{
        "waggle-push-forward": "waggle-vt-push-exit",
        "waggle-push-back": "waggle-vt-pop-exit",
        "waggle-modal-up": "waggle-vt-modal-exit",
        "waggle-modal-down": "waggle-vt-modal-close-exit",
        default: "none",
      }}
      default="none"
    >
      <div className="flex min-h-dvh flex-1 flex-col bg-canvas">{children}</div>
    </ViewTransition>
  );
}
