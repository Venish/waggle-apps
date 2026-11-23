"use client";

import { useEffect, useRef } from "react";

interface LayerEntry {
  id: string;
  onClose: () => void;
  closeOnEscape: boolean;
  lockScroll: boolean;
  skipHistoryBack: boolean;
}

const layerStack: LayerEntry[] = [];
let listenersAttached = false;
let ignorePopCount = 0;

/**
 * 단일 data-scroll-locked 속성으로 html/body/.waggle-app-shell 스크롤 잠금을 통합 제어한다.
 * 인라인 style 직접 조작으로 인한 중첩 시트·라우트 전환 시 복원 누락을 원천 차단한다.
 */
function syncBodyScrollLock() {
  if (typeof document === "undefined") return;
  const shouldLock = layerStack.some((entry) => entry.lockScroll);
  if (shouldLock) {
    document.documentElement.dataset.scrollLocked = "true";
  } else {
    delete document.documentElement.dataset.scrollLocked;
  }
}

function handleGlobalPopState() {
  if (ignorePopCount > 0) {
    ignorePopCount -= 1;
    return;
  }
  const top = layerStack.pop();
  if (!top) return;
  syncBodyScrollLock();
  top.onClose();
}

function handleGlobalKeyDown(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  const top = layerStack[layerStack.length - 1];
  if (!top || !top.closeOnEscape) return;
  e.preventDefault();
  top.onClose();
}

function ensureGlobalListeners() {
  if (listenersAttached || typeof window === "undefined") return;
  window.addEventListener("popstate", handleGlobalPopState);
  window.addEventListener("keydown", handleGlobalKeyDown);
  listenersAttached = true;
}

/**
 * 시트/모달에서 router.push 등 라우트 전환 직전에 호출하여
 * 언마운트 시 history.back()이 방금 실행한 내비게이션을 취소하지 않도록 보호한다.
 */
export function skipLayerHistoryBack(modalId?: string) {
  if (modalId) {
    const found = layerStack.find((item) => item.id === modalId);
    if (found) found.skipHistoryBack = true;
    return;
  }
  for (const item of layerStack) {
    item.skipHistoryBack = true;
  }
}

interface UseModalHistoryOptions {
  isOpen: boolean;
  onClose: () => void;
  modalId?: string;
  closeOnEscape?: boolean;
  lockScroll?: boolean;
}

/**
 * 단일 LIFO 전역 레이어 스택 기반 History / ESC / Scroll-Lock 훅
 * - 시트(z-40) → 피커 모달(z-50) → Alert(z-60) 중첩 시 항상 최상단 1개만 닫힌다.
 * - 버튼으로 피커를 닫을 때 history.back()이 부모 시트를 연쇄 닫는 문제를 ignorePopCount로 차단한다.
 * - body overflow 스크롤 잠금을 레퍼런스 카운트 방식으로 단일 관리한다.
 */
export function useModalHistory({
  isOpen,
  onClose,
  modalId = "global-modal",
  closeOnEscape = true,
  lockScroll = true,
}: UseModalHistoryOptions) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    ensureGlobalListeners();

    const entry: LayerEntry = {
      id: modalId,
      onClose: () => onCloseRef.current(),
      closeOnEscape,
      lockScroll,
      skipHistoryBack: false,
    };

    layerStack.push(entry);
    syncBodyScrollLock();
    window.history.pushState({ waggleLayer: true, modalId }, "");

    return () => {
      const idx = layerStack.indexOf(entry);
      if (idx === -1) {
        // 이미 popstate로 pop되어 닫힌 경우 — history.back() 중복 호출 금지
        syncBodyScrollLock();
        return;
      }

      layerStack.splice(idx, 1);
      syncBodyScrollLock();

      if (!entry.skipHistoryBack && window.history.state?.waggleLayer) {
        ignorePopCount += 1;
        window.history.back();
      }
    };
  }, [isOpen, modalId, closeOnEscape, lockScroll]);
}
