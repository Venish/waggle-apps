"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@repo/ui";
import { AppButton } from "./AppButton";
import { AppCenterModal } from "./AppCenterModal";

interface AppTimePickerProps {
  label?: string;
  description?: string;
  modalTitle?: string;
  value: string; // "HH:MM" (24h, e.g. "20:00")
  onChange: (value: string) => void;
  className?: string;
}

const PERIODS = ["오전", "오후"] as const;
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i); // 0..59 (1분 단위)

function parse24h(hhmm: string): { periodIdx: 0 | 1; hour12: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  const rawH = match ? Math.min(23, Math.max(0, Number(match[1]))) : 20;
  const rawM = match ? Math.min(59, Math.max(0, Number(match[2]))) : 0;
  const periodIdx: 0 | 1 = rawH >= 12 ? 1 : 0;
  const hour12 = rawH % 12 === 0 ? 12 : rawH % 12;
  return { periodIdx, hour12, minute: rawM };
}

function to24h(periodIdx: 0 | 1, hour12: number, minute: number): string {
  let h24 = hour12 % 12;
  if (periodIdx === 1) h24 += 12;
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatKoreanTime(periodIdx: 0 | 1, hour12: number, minute: number): string {
  return `${PERIODS[periodIdx]} ${hour12}:${String(minute).padStart(2, "0")}`;
}

/**
 * 60fps iOS UIPickerView 스타일 GPU 드럼 휠 열
 * - CSS scroll-snap 충돌을 제거하고 translate3d + rotateX 원통 곡률 + 관성 감속 + 양끝 러버밴드 직접 구현
 * - 드래그 중에는 DOM style만 60fps로 갱신하고 정수 인덱스 경계 통과 시에만 React 상태를 업데이트
 */
function WheelColumn({
  items,
  selectedIndex,
  onSelect,
  open,
  ariaLabel,
}: {
  items: readonly string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  open: boolean;
  ariaLabel: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const offsetRef = useRef(0);
  const activeIdxRef = useRef(selectedIndex);
  const animRafRef = useRef<number | null>(null);
  const wheelSnapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);
  const maxMoveRef = useRef(0);
  const lastYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0); // px / ms (양수 = 아래로 드래그, offset 감소 방향)

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const getItemHeight = useCallback(() => {
    const first = itemRefs.current[0];
    return first && first.offsetHeight > 0 ? first.offsetHeight : 44;
  }, []);

  const stopAnimation = useCallback(() => {
    if (animRafRef.current !== null) {
      cancelAnimationFrame(animRafRef.current);
      animRafRef.current = null;
    }
  }, []);

  const renderOffset = useCallback(
    (rawOffset: number, emitChange: boolean) => {
      const itemH = getItemHeight();
      offsetRef.current = rawOffset;

      const track = trackRef.current;
      if (track) {
        track.style.transform = `translate3d(0, ${-rawOffset}px, 0)`;
      }

      const nodes = itemRefs.current;
      for (let i = 0; i < items.length; i += 1) {
        const node = nodes[i];
        if (!node) continue;
        const dist = (i * itemH - rawOffset) / itemH;
        const absDist = Math.abs(dist);
        if (absDist > 3.4) {
          node.style.opacity = "0";
          node.style.transform = "scale(0.8)";
          continue;
        }
        const rotateX = Math.max(-64, Math.min(64, -dist * 21));
        const scale = Math.max(0.84, 1 - absDist * 0.075);
        const opacity = Math.max(0.16, 1 - absDist * 0.34);
        node.style.opacity = String(opacity);
        node.style.transform = `perspective(240px) rotateX(${rotateX.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
      }

      if (emitChange && itemH > 0) {
        const clampedIdx = Math.max(
          0,
          Math.min(items.length - 1, Math.round(rawOffset / itemH)),
        );
        if (clampedIdx !== activeIdxRef.current) {
          activeIdxRef.current = clampedIdx;
          onSelectRef.current(clampedIdx);
        }
      }
    },
    [getItemHeight, items.length],
  );

  const animateToIndex = useCallback(
    (targetIdx: number, durationMs = 260) => {
      stopAnimation();
      const itemH = getItemHeight();
      const clampedIdx = Math.max(0, Math.min(items.length - 1, targetIdx));
      const fromOffset = offsetRef.current;
      const toOffset = clampedIdx * itemH;

      if (Math.abs(toOffset - fromOffset) < 0.5) {
        renderOffset(toOffset, true);
        return;
      }

      const startTime = performance.now();
      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / durationMs);
        // iOS UIPickerView 감속 커브 (부드러운 Quintic-ish easeOut)
        const eased = 1 - Math.pow(1 - t, 3.6);
        renderOffset(fromOffset + (toOffset - fromOffset) * eased, true);
        if (t < 1) {
          animRafRef.current = requestAnimationFrame(step);
        } else {
          animRafRef.current = null;
          renderOffset(toOffset, true);
        }
      };

      animRafRef.current = requestAnimationFrame(step);
    },
    [getItemHeight, items.length, renderOffset, stopAnimation],
  );

  // 모달 오픈 시 선택 항목으로 즉시 배치
  useEffect(() => {
    if (!open) return;
    activeIdxRef.current = selectedIndex;
    const raf = requestAnimationFrame(() => {
      const itemH = getItemHeight();
      renderOffset(selectedIndex * itemH, false);
    });
    return () => {
      cancelAnimationFrame(raf);
      stopAnimation();
      if (wheelSnapTimerRef.current) clearTimeout(wheelSnapTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 마우스 휠 / 트랙패드 스크롤 (non-passive로 모달 배경 스크롤 방지)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !open) return;

    const handleWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      stopAnimation();

      const itemH = getItemHeight();
      const maxOffset = (items.length - 1) * itemH;

      // Windows 마우스 휠(100px 단위)과 Mac 트랙패드(연속 소량 delta) 모두 자연스럽게 정규화
      const isDiscreteWheel = Math.abs(ev.deltaY) >= 50 && ev.deltaMode === 0;
      const deltaPx = isDiscreteWheel
        ? Math.sign(ev.deltaY) * itemH
        : ev.deltaY * 0.65;

      const nextOffset = Math.max(0, Math.min(maxOffset, offsetRef.current + deltaPx));
      if (isDiscreteWheel) {
        const targetIdx = Math.round(nextOffset / itemH);
        animateToIndex(targetIdx, 190);
        return;
      }

      renderOffset(nextOffset, true);
      if (wheelSnapTimerRef.current) clearTimeout(wheelSnapTimerRef.current);
      wheelSnapTimerRef.current = setTimeout(() => {
        const snapIdx = Math.round(offsetRef.current / itemH);
        animateToIndex(snapIdx, 220);
      }, 95);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
      if (wheelSnapTimerRef.current) clearTimeout(wheelSnapTimerRef.current);
    };
  }, [animateToIndex, getItemHeight, items.length, open, renderOffset, stopAnimation]);

  // 통합 Pointer Events (모바일 터치 + PC 마우스 드래그 100% 동일 물리)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    stopAnimation();
    if (wheelSnapTimerRef.current) clearTimeout(wheelSnapTimerRef.current);

    draggingRef.current = true;
    pointerIdRef.current = e.pointerId;
    startYRef.current = e.clientY;
    startOffsetRef.current = offsetRef.current;
    maxMoveRef.current = 0;
    lastYRef.current = e.clientY;
    lastTimeRef.current = performance.now();
    velocityRef.current = 0;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 일부 환경 안전 무시
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || pointerIdRef.current !== e.pointerId) return;

    const now = performance.now();
    const dyFromStart = e.clientY - startYRef.current;
    maxMoveRef.current = Math.max(maxMoveRef.current, Math.abs(dyFromStart));

    const dt = now - lastTimeRef.current;
    if (dt > 0) {
      const instantV = (e.clientY - lastYRef.current) / dt;
      velocityRef.current = velocityRef.current * 0.45 + instantV * 0.55;
      lastYRef.current = e.clientY;
      lastTimeRef.current = now;
    }

    const itemH = getItemHeight();
    const maxOffset = (items.length - 1) * itemH;
    let raw = startOffsetRef.current - dyFromStart;

    // iOS 양끝 러버밴드 탄성 저항
    if (raw < 0) {
      raw = raw * 0.28;
    } else if (raw > maxOffset) {
      raw = maxOffset + (raw - maxOffset) * 0.28;
    }

    renderOffset(raw, true);
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || pointerIdRef.current !== e.pointerId) return;
    draggingRef.current = false;
    pointerIdRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // 안전 무시
    }

    const itemH = getItemHeight();
    const maxOffset = (items.length - 1) * itemH;

    // 클릭(탭)으로 판정된 경우: 탭한 버튼으로 부드럽게 이동
    if (maxMoveRef.current < 5) {
      const targetEl = document.elementFromPoint(e.clientX, e.clientY);
      const btn = targetEl?.closest("button[data-wheel-index]") as HTMLButtonElement | null;
      if (btn) {
        const idx = Number(btn.dataset.wheelIndex);
        if (Number.isInteger(idx)) {
          animateToIndex(idx, 240);
          return;
        }
      }
      animateToIndex(Math.round(offsetRef.current / itemH), 200);
      return;
    }

    // 마지막 이동 후 멈칫했다가 떼면 관성 제거
    const idleMs = performance.now() - lastTimeRef.current;
    const v = idleMs > 90 ? 0 : velocityRef.current;

    // iOS 관성 투사 거리 계산 후 가장 가까운 슬롯으로 부드럽게 안착
    const momentumPx = -v * 280;
    const projected = Math.max(0, Math.min(maxOffset, offsetRef.current + momentumPx));
    const targetIdx = Math.max(0, Math.min(items.length - 1, Math.round(projected / itemH)));
    const travelPx = Math.abs(targetIdx * itemH - offsetRef.current);
    const duration = Math.min(540, Math.max(210, 180 + travelPx * 0.9));

    animateToIndex(targetIdx, duration);
  };

  return (
    <div
      ref={viewportRef}
      role="listbox"
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      className="relative z-10 h-55 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
    >
      <div
        ref={trackRef}
        className="will-change-transform"
        style={{ paddingTop: "5.5rem", paddingBottom: "5.5rem" }}
      >
        {items.map((text, idx) => {
          const isActive = idx === selectedIndex;
          return (
            <button
              key={text}
              ref={(node) => {
                itemRefs.current[idx] = node;
              }}
              type="button"
              role="option"
              data-wheel-index={idx}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={cn(
                "flex h-11 w-full items-center justify-center tabular-nums text-xl",
                isActive ? "font-extrabold text-ink" : "font-semibold text-ink-muted",
              )}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 공용 iOS 3열 드럼 스크롤 시간 선택기 (오전/오후 · 1~12시 · 00~59분 1분 단위)
 * - 60fps GPU translate3d + rotateX 원통 곡률 + 관성 감속 + 러버밴드 (외부 라이브러리 0개)
 * - 입력/시계 아이콘 어느 곳을 클릭해도 화면 정중앙 모달로 오픈
 */
export function AppTimePicker({
  label,
  description,
  modalTitle,
  value,
  onChange,
  className,
}: AppTimePickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = parse24h(value);

  const [draftPeriod, setDraftPeriod] = useState<0 | 1>(parsed.periodIdx);
  const [draftHourIdx, setDraftHourIdx] = useState(parsed.hour12 - 1);
  const [draftMinuteIdx, setDraftMinuteIdx] = useState(parsed.minute);

  const openModal = () => {
    const p = parse24h(value);
    setDraftPeriod(p.periodIdx);
    setDraftHourIdx(p.hour12 - 1);
    setDraftMinuteIdx(p.minute);
    setOpen(true);
  };

  const handleConfirm = () => {
    onChange(to24h(draftPeriod, HOURS_12[draftHourIdx]!, MINUTES_60[draftMinuteIdx]!));
    setOpen(false);
  };

  const displayStr = formatKoreanTime(parsed.periodIdx, parsed.hour12, parsed.minute);
  const draftKorean = formatKoreanTime(
    draftPeriod,
    HOURS_12[draftHourIdx]!,
    MINUTES_60[draftMinuteIdx]!,
  );
  const draft24 = to24h(draftPeriod, HOURS_12[draftHourIdx]!, MINUTES_60[draftMinuteIdx]!);

  return (
    <div className={cn("group/field w-full", className)}>
      {label && (
        <p
          className={cn(
            "text-xs font-semibold transition-colors duration-200",
            open ? "text-brand-strong" : "text-ink group-focus-within/field:text-brand-strong",
          )}
        >
          {label}
        </p>
      )}
      <div className="relative mt-1 border-b border-border-subtle">
        <button
          type="button"
          onClick={openModal}
          aria-label={`${label ?? "시간"} 선택 열기`}
          className="flex h-13 w-full items-center justify-between gap-2 text-left transition-opacity active:opacity-70"
        >
          <span className="text-2xl font-extrabold tracking-tight tabular-nums text-ink">
            {displayStr}
          </span>
          <span className="flex size-9 items-center justify-center rounded-xl text-ink-muted transition-colors group-hover/field:bg-surface-subtle group-hover/field:text-brand-strong">
            <Clock className="size-5" strokeWidth={1.9} />
          </span>
        </button>
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 -bottom-px h-0.5 origin-left bg-brand transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]",
            open ? "scale-x-100" : "scale-x-0 group-focus-within/field:scale-x-100",
          )}
        />
      </div>
      {description && (
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{description}</p>
      )}

      <AppCenterModal
        open={open}
        onClose={() => setOpen(false)}
        title={modalTitle ?? label ?? "시간 선택"}
        hideHeader
        modalId={`time-${label ?? "picker"}`}
      >
        {/* Top Live Preview */}
        <div className="border-b border-border-subtle px-5 pt-4 pb-3">
          <p className="text-xs font-medium text-ink-muted">
            {modalTitle ?? label ?? "알림 시각 선택"}
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <p className="text-2xl font-extrabold tracking-tight tabular-nums text-ink">
              {draftKorean}
            </p>
            <span className="text-xs font-medium tabular-nums text-ink-muted">{draft24} KST</span>
          </div>
        </div>

        {/* 3-Column iOS Drum Wheel */}
        <div className="relative px-4 py-3">
          {/* Center Selection Highlight Bar */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-4 top-1/2 h-11 -translate-y-1/2 rounded-xl bg-surface-subtle"
          />

          {/* Top & Bottom Soft Fade Masks */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-4 top-3 z-20 h-18 bg-gradient-to-b from-surface via-surface/80 to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-4 bottom-3 z-20 h-18 bg-gradient-to-t from-surface via-surface/80 to-transparent"
          />

          <div className="grid grid-cols-3 items-center">
            <WheelColumn
              ariaLabel="오전 오후 선택"
              items={PERIODS}
              selectedIndex={draftPeriod}
              onSelect={(idx) => setDraftPeriod(idx === 1 ? 1 : 0)}
              open={open}
            />
            <WheelColumn
              ariaLabel="시 선택"
              items={HOURS_12.map((h) => `${h}시`)}
              selectedIndex={draftHourIdx}
              onSelect={setDraftHourIdx}
              open={open}
            />
            <WheelColumn
              ariaLabel="분 선택"
              items={MINUTES_60.map((m) => `${String(m).padStart(2, "0")}분`)}
              selectedIndex={draftMinuteIdx}
              onSelect={setDraftMinuteIdx}
              open={open}
            />
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="flex items-center justify-end gap-1.5 border-t border-border-subtle px-4 py-3">
          <AppButton variant="ghost" size="sm" onClick={() => setOpen(false)}>
            취소
          </AppButton>
          <AppButton variant="primary" size="sm" className="px-4" onClick={handleConfirm}>
            확인
          </AppButton>
        </div>
      </AppCenterModal>
    </div>
  );
}
