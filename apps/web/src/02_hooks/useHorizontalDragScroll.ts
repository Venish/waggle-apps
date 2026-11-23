"use client";

import { useRef, type MouseEvent, type PointerEvent } from "react";

/**
 * 모바일 네이티브 터치 스와이프 + 데스크톱 마우스 드래그 스크롤 공용 훅
 * - 터치(touch/pen): 브라우저 네이티브 60fps 관성 스크롤 & scroll-snap 그대로 위임
 * - 마우스(mouse): 드래그 스크롤 보조 + 5px 초과 드래그 시 자식 클릭 이벤트(onClickCapture) 자동 차단
 */
export function useHorizontalDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const stateRef = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
    prevSnap: "",
  });

  const endDrag = () => {
    const el = ref.current;
    if (stateRef.current.active && el) {
      el.style.scrollSnapType = stateRef.current.prevSnap;
    }
    stateRef.current.active = false;
  };

  const dragProps = {
    onPointerDown: (e: PointerEvent<T>) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const el = ref.current;
      if (!el) return;
      stateRef.current = {
        active: true,
        startX: e.clientX,
        startScrollLeft: el.scrollLeft,
        moved: false,
        prevSnap: el.style.scrollSnapType,
      };
    },
    onPointerMove: (e: PointerEvent<T>) => {
      if (!stateRef.current.active || e.pointerType !== "mouse") return;
      const el = ref.current;
      if (!el) return;
      const dx = e.clientX - stateRef.current.startX;
      if (!stateRef.current.moved && Math.abs(dx) > 5) {
        stateRef.current.moved = true;
        el.style.scrollSnapType = "none";
      }
      if (stateRef.current.moved) {
        el.scrollLeft = stateRef.current.startScrollLeft - dx;
      }
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onPointerLeave: endDrag,
    onClickCapture: (e: MouseEvent<T>) => {
      if (stateRef.current.moved) {
        e.preventDefault();
        e.stopPropagation();
        stateRef.current.moved = false;
      }
    },
  };

  return { ref, dragProps };
}
