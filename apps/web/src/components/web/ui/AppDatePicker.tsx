"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@repo/ui";
import { AppCenterModal } from "./AppCenterModal";
import { renderFieldLabel } from "./AppField";

interface AppDatePickerProps {
  label?: string;
  description?: string;
  modalTitle?: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  minYear?: number;
  maxYear?: number;
  className?: string;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const check = new Date(y, m - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return null;
  return { y, m, d };
}

function formatYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatDotDisplay(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return "";
  return `${p.y}.${String(p.m).padStart(2, "0")}.${String(p.d).padStart(2, "0")}`;
}

function formatKoreanFull(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return "날짜를 선택해 주세요";
  const dow = WEEKDAYS[new Date(p.y, p.m - 1, p.d).getDay()];
  return `${p.y}년 ${p.m}월 ${p.d}일 (${dow})`;
}

/**
 * 공용 최신 날짜 선택기 (AppDatePicker)
 * - 1) 토스식 숫자 직접 타이핑 자동 포맷(예: 20250601 -> 2025.06.01, inputMode="numeric")
 * - 2) 우측 달력 아이콘 클릭 시 화면 정중앙 최신 모달 달력 오픈
 *   - 년(Year Grid) / 월(Month Grid) / 일(Day Grid) 원클릭 전환
 *   - 이전달 / 다음달 이동
 *   - 하단 [오늘] · [취소] · [확인] 액션 바 완비
 */
export function AppDatePicker({
  label,
  description,
  modalTitle,
  value,
  onChange,
  placeholder = "YYYY.MM.DD",
  minYear = 2005,
  maxYear = new Date().getFullYear() + 5,
  className,
}: AppDatePickerProps) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => formatDotDisplay(value));

  const now = new Date();
  const todayStr = formatYmd(now.getFullYear(), now.getMonth() + 1, now.getDate());

  // 모달 내부 임시 선택 상태 (취소 시 원본 value 유지)
  const initialParsed = parseYmd(value) ?? {
    y: now.getFullYear(),
    m: now.getMonth() + 1,
    d: now.getDate(),
  };
  const [viewYear, setViewYear] = useState(initialParsed.y);
  const [viewMonth, setViewMonth] = useState(initialParsed.m); // 1~12
  const [draftDate, setDraftDate] = useState<string>(value || todayStr);
  const [panel, setPanel] = useState<"day" | "year" | "month">("day");

  // 외부 value 동기화
  useEffect(() => {
    setText(formatDotDisplay(value));
  }, [value]);

  const openCalendar = () => {
    const p = parseYmd(value) ?? {
      y: now.getFullYear(),
      m: now.getMonth() + 1,
      d: now.getDate(),
    };
    setViewYear(p.y);
    setViewMonth(p.m);
    setDraftDate(value || todayStr);
    setPanel("day");
    setOpen(true);
  };

  // 숫자 직접 입력 시 자동 "YYYY.MM.DD" 포맷팅
  const handleTextChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 6) {
      formatted = `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
    } else if (digits.length > 4) {
      formatted = `${digits.slice(0, 4)}.${digits.slice(4)}`;
    }
    setText(formatted);

    if (digits.length === 8) {
      const candidate = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
      if (parseYmd(candidate)) {
        onChange(candidate);
      }
    } else if (digits.length === 0) {
      onChange("");
    }
  };

  const handleTextBlur = () => {
    // 불완전 입력 시 마지막 유효값으로 복원
    setText(formatDotDisplay(value));
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth - 1 + delta, 1);
    const nextY = next.getFullYear();
    if (nextY < minYear || nextY > maxYear) return;
    setViewYear(nextY);
    setViewMonth(next.getMonth() + 1);
  };

  const handleJumpToday = () => {
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth() + 1);
    setDraftDate(todayStr);
    setPanel("day");
  };

  const handleConfirm = () => {
    if (draftDate) onChange(draftDate);
    setOpen(false);
  };

  // 42칸(6주) 깔끔한 캘린더 셀 생성 (이전달/다음달 흐린 날짜 포함)
  const calendarCells = useMemo(() => {
    const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay();
    const daysInCurr = new Date(viewYear, viewMonth, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth - 1, 0).getDate();

    const cells: Array<{ ymd: string; day: number; inMonth: boolean; dow: number }> = [];

    // 이전 달 꼬리
    const prevDate = new Date(viewYear, viewMonth - 2, 1);
    const prevY = prevDate.getFullYear();
    const prevM = prevDate.getMonth() + 1;
    for (let i = firstDow - 1; i >= 0; i--) {
      const d = daysInPrev - i;
      cells.push({ ymd: formatYmd(prevY, prevM, d), day: d, inMonth: false, dow: cells.length % 7 });
    }

    // 현재 달
    for (let d = 1; d <= daysInCurr; d++) {
      cells.push({
        ymd: formatYmd(viewYear, viewMonth, d),
        day: d,
        inMonth: true,
        dow: cells.length % 7,
      });
    }

    // 다음 달 머리 (항상 6주=42칸 고정으로 월 이동 시 모달 높이 점프 방지)
    const nextDate = new Date(viewYear, viewMonth, 1);
    const nextY = nextDate.getFullYear();
    const nextM = nextDate.getMonth() + 1;
    let nextD = 1;
    while (cells.length < 42) {
      cells.push({
        ymd: formatYmd(nextY, nextM, nextD),
        day: nextD,
        inMonth: false,
        dow: cells.length % 7,
      });
      nextD++;
    }

    return cells;
  }, [viewYear, viewMonth]);

  const years = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i),
    [minYear, maxYear],
  );

  return (
    <div className={cn("group/field w-full", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            "block text-xs font-semibold transition-colors duration-200",
            open ? "text-brand-strong" : "text-ink group-focus-within/field:text-brand-strong",
          )}
        >
          {renderFieldLabel(label)}
        </label>
      )}
      <div className="relative mt-1 flex items-center border-b border-border-subtle">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          data-toss-underline="true"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleTextBlur}
          placeholder={placeholder}
          className="h-11 w-full bg-transparent pr-9 text-base font-medium tabular-nums text-ink placeholder:font-normal placeholder:text-ink-muted/65"
        />
        <button
          type="button"
          onClick={openCalendar}
          aria-label={`${label ?? "날짜"} 달력 열기`}
          className="absolute right-0 flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-subtle hover:text-brand-strong active:opacity-70"
        >
          <CalendarDays className="size-4.5" strokeWidth={1.9} />
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
        title={modalTitle ?? label ?? "날짜 선택"}
        hideHeader
        modalId={`calendar-${label ?? "picker"}`}
      >
        {/* Top Selected Date Summary Banner */}
        <div className="border-b border-border-subtle px-5 pt-4 pb-3">
          <p className="text-xs font-medium text-ink-muted">{modalTitle ?? label ?? "날짜 선택"}</p>
          <p className="mt-1 text-lg font-extrabold tracking-tight tabular-nums text-ink">
            {formatKoreanFull(draftDate)}
          </p>
        </div>

        {/* Year / Month Selector & Prev/Next Controls */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPanel((p) => (p === "year" ? "day" : "year"))}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-bold tabular-nums transition-colors",
                panel === "year"
                  ? "bg-brand-soft text-brand-strong"
                  : "text-ink hover:bg-surface-subtle",
              )}
            >
              {viewYear}년
              <ChevronDown
                className={cn(
                  "size-3.5 text-ink-muted transition-transform",
                  panel === "year" && "rotate-180 text-brand-strong",
                )}
                strokeWidth={2.2}
              />
            </button>
            <button
              type="button"
              onClick={() => setPanel((p) => (p === "month" ? "day" : "month"))}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-bold tabular-nums transition-colors",
                panel === "month"
                  ? "bg-brand-soft text-brand-strong"
                  : "text-ink hover:bg-surface-subtle",
              )}
            >
              {viewMonth}월
              <ChevronDown
                className={cn(
                  "size-3.5 text-ink-muted transition-transform",
                  panel === "month" && "rotate-180 text-brand-strong",
                )}
                strokeWidth={2.2}
              />
            </button>
          </div>

          {panel === "day" && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="이전 달"
                className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
              >
                <ChevronLeft className="size-4.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="다음 달"
                className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
              >
                <ChevronRight className="size-4.5" strokeWidth={2} />
              </button>
            </div>
          )}
        </div>

        {/* Body: Day Grid / Year Grid / Month Grid (고정 높이 h-68로 전환 시 모달 점프 방지) */}
        <div className="h-68 px-4 pb-3">
          {panel === "year" && (
            <div className="grid h-full grid-cols-4 content-start gap-1.5 overflow-y-auto py-1">
              {years.map((y) => {
                const active = y === viewYear;
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setViewYear(y);
                      setPanel("month");
                    }}
                    className={cn(
                      "h-10 rounded-xl text-sm tabular-nums transition-colors",
                      active
                        ? "bg-brand font-bold text-on-brand"
                        : "bg-surface-subtle font-medium text-ink hover:bg-brand-soft hover:text-brand-strong",
                    )}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          )}

          {panel === "month" && (
            <div className="grid h-full grid-cols-3 content-center gap-2 py-2">
              {Array.from({ length: 12 }, (_, idx) => {
                const m = idx + 1;
                const active = m === viewMonth;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setViewMonth(m);
                      setPanel("day");
                    }}
                    className={cn(
                      "h-11 rounded-xl text-sm tabular-nums transition-colors",
                      active
                        ? "bg-brand font-bold text-on-brand"
                        : "bg-surface-subtle font-medium text-ink hover:bg-brand-soft hover:text-brand-strong",
                    )}
                  >
                    {m}월
                  </button>
                );
              })}
            </div>
          )}

          {panel === "day" && (
            <div>
              <div className="mb-1 grid grid-cols-7 text-center">
                {WEEKDAYS.map((w, idx) => (
                  <div
                    key={w}
                    className={cn(
                      "py-1.5 text-xs font-medium",
                      idx === 0 ? "text-destructive/80" : "text-ink-muted",
                    )}
                  >
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-0.5 text-center">
                {calendarCells.map((cell) => {
                  const isSelected = cell.ymd === draftDate;
                  const isToday = cell.ymd === todayStr;

                  return (
                    <button
                      key={cell.ymd}
                      type="button"
                      onClick={() => {
                        setDraftDate(cell.ymd);
                        if (!cell.inMonth) {
                          const p = parseYmd(cell.ymd);
                          if (p) {
                            setViewYear(p.y);
                            setViewMonth(p.m);
                          }
                        }
                      }}
                      className={cn(
                        "relative mx-auto flex size-9 items-center justify-center rounded-xl text-sm tabular-nums transition-all active:scale-95",
                        isSelected
                          ? "bg-brand font-bold text-on-brand"
                          : !cell.inMonth
                            ? "text-ink-muted/35 hover:bg-surface-subtle"
                            : isToday
                              ? "bg-brand-soft font-bold text-brand-strong"
                              : cell.dow === 0
                                ? "font-medium text-destructive/85 hover:bg-surface-subtle"
                                : "font-medium text-ink hover:bg-surface-subtle",
                      )}
                    >
                      {cell.day}
                      {isToday && !isSelected && (
                        <span className="absolute bottom-1 size-1 rounded-full bg-brand" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Action Bar: [오늘]  ...  [취소] [확인] */}
        <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3">
          <button
            type="button"
            onClick={handleJumpToday}
            className="h-9 rounded-lg px-3 text-sm font-semibold text-brand-strong transition-colors hover:bg-brand-soft active:opacity-75"
          >
            오늘
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 rounded-lg px-3.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="h-9 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand transition-opacity hover:opacity-95 active:scale-[0.98]"
            >
              확인
            </button>
          </div>
        </div>
      </AppCenterModal>
    </div>
  );
}
