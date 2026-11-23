"use client";

import type { ReactNode } from "react";
import { create } from "zustand";
import { skipLayerHistoryBack } from "@/02_hooks/useModalHistory";

export type OverlayDirection = "slide-left" | "slide-up";

export interface ModalStackItem {
  id: string;
  title?: string;
  subtitle?: string;
  direction: OverlayDirection;
  /** 내부 콘텐츠가 자체 sticky 하단 액션 바를 가질 때 시트 스크롤 래퍼의 하단 패딩을 제거한다. */
  stickyFooter?: boolean;
  content: ReactNode;
}

interface ModalStoreState {
  stack: ModalStackItem[];
  openModal: (item: Omit<ModalStackItem, "id"> & { id?: string }) => string;
  closeTopModal: () => void;
  closeModalById: (id: string) => void;
  /** router.push/replace 등 라우트 이동 시 history.back() 충돌 없이 시트를 즉시 해제한다. 시트가 열려 있었다면 true 반환. */
  dismissForNavigation: () => boolean;
  clearModals: () => void;
}

export const useModalStore = create<ModalStoreState>((set, get) => ({
  stack: [],
  openModal: (item) => {
    const id = item.id ?? `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // Max Depth = 1: 시트 위에 2차 시트 적재를 차단하고 단일 시트로 교체한다.
    const prevTop = get().stack[0];
    if (prevTop) {
      skipLayerHistoryBack(prevTop.id);
    }
    set({
      stack: [
        {
          id,
          title: item.title,
          subtitle: item.subtitle,
          direction: item.direction,
          stickyFooter: item.stickyFooter,
          content: item.content,
        },
      ],
    });
    return id;
  },
  closeTopModal: () =>
    set((state) => ({
      stack: state.stack.slice(0, -1),
    })),
  closeModalById: (id) =>
    set((state) => ({
      stack: state.stack.filter((modal) => modal.id !== id),
    })),
  dismissForNavigation: () => {
    const current = get().stack;
    if (current.length === 0) return false;
    for (const item of current) {
      skipLayerHistoryBack(item.id);
    }
    set({ stack: [] });
    return true;
  },
  clearModals: () => set({ stack: [] }),
}));
