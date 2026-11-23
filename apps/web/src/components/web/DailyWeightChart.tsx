"use client";

import { useMemo, useState } from "react";
import { cn } from "@repo/ui";
import { useHorizontalDragScroll } from "@/02_hooks/useHorizontalDragScroll";

export interface WeightPoint {
  entryDate: string; // YYYY-MM-DD
  weightKg: number;
}

type WeightRange = "all" | "year" | "month";

interface WeightBarItem {
  key: string;
  label: string;
  weightKg: number;
}

function formatKg(val: number): string {
  return Number.isInteger(val) ? val.toFixed(1) : Number(val.toFixed(2)).toString();
}

function avgWeight(values: number[]): number {
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Number((sum / values.length).toFixed(2));
}

/**
 * 기간별 자동 버킷팅 (기록이 100~1,000건 쌓여도 최대 12개 막대 이내 유지)
 * - 월: 이번 달 일별 (12건 초과 시 주차별 평균으로 자동 압축)
 * - 년: 올해 월별 평균 (최대 12개: 1월~12월)
 * - 전체: 연도별 평균 (최대 10개: 2024~2026 / 1년 미만이면 월별, 1개월 미만이면 일별 폴백)
 */
function buildBars(
  sortedRecords: WeightPoint[],
  range: WeightRange,
  todayStr: string,
): WeightBarItem[] {
  if (sortedRecords.length === 0) return [];

  const latestDate = sortedRecords[sortedRecords.length - 1]!.entryDate;
  const currentYm = todayStr.slice(0, 7);
  const currentYear = todayStr.slice(0, 4);

  if (range === "month") {
    const thisMonth = sortedRecords.filter((r) => r.entryDate.startsWith(currentYm));
    const targetMonth = thisMonth.length > 0 ? currentYm : latestDate.slice(0, 7);
    const monthRows = sortedRecords.filter((r) => r.entryDate.startsWith(targetMonth));

    if (monthRows.length <= 12) {
      return monthRows.map((r) => ({
        key: r.entryDate,
        label: `${Number(r.entryDate.slice(8, 10))}일`,
        weightKg: r.weightKg,
      }));
    }

    // 한 달에 13건 이상 기록 시 주차별 평균(최대 5막대)으로 자동 압축
    const byWeek = new Map<number, number[]>();
    for (const r of monthRows) {
      const day = Number(r.entryDate.slice(8, 10));
      const week = Math.min(5, Math.ceil(day / 7));
      const arr = byWeek.get(week) ?? [];
      arr.push(r.weightKg);
      byWeek.set(week, arr);
    }
    return Array.from(byWeek.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([w, vals]) => ({
        key: `${targetMonth}-w${w}`,
        label: `${w}주`,
        weightKg: avgWeight(vals),
      }));
  }

  if (range === "year") {
    const thisYear = sortedRecords.filter((r) => r.entryDate.startsWith(currentYear));
    const targetYear = thisYear.length > 0 ? currentYear : latestDate.slice(0, 4);
    const byMonth = new Map<string, number[]>();
    for (const r of sortedRecords) {
      if (!r.entryDate.startsWith(targetYear)) continue;
      const ym = r.entryDate.slice(0, 7);
      const arr = byMonth.get(ym) ?? [];
      arr.push(r.weightKg);
      byMonth.set(ym, arr);
    }
    return Array.from(byMonth.entries()).map(([ym, vals]) => ({
      key: ym,
      label: `${Number(ym.slice(5, 7))}월`,
      weightKg: avgWeight(vals),
    }));
  }

  // range === "all": 연도별 평균 (10년 치도 10막대 이내) → 1개 연도뿐이면 월별 → 1개 월뿐이면 일별
  const byYear = new Map<string, number[]>();
  for (const r of sortedRecords) {
    const y = r.entryDate.slice(0, 4);
    const arr = byYear.get(y) ?? [];
    arr.push(r.weightKg);
    byYear.set(y, arr);
  }
  if (byYear.size > 1) {
    return Array.from(byYear.entries())
      .slice(-10)
      .map(([y, vals]) => ({
        key: y,
        label: `${y}년`,
        weightKg: avgWeight(vals),
      }));
  }

  const byMonth = new Map<string, number[]>();
  for (const r of sortedRecords) {
    const ym = r.entryDate.slice(0, 7);
    const arr = byMonth.get(ym) ?? [];
    arr.push(r.weightKg);
    byMonth.set(ym, arr);
  }
  if (byMonth.size > 1) {
    return Array.from(byMonth.entries())
      .slice(-12)
      .map(([ym, vals]) => ({
        key: ym,
        label: `${Number(ym.slice(5, 7))}월`,
        weightKg: avgWeight(vals),
      }));
  }

  return sortedRecords.slice(-12).map((r) => ({
    key: r.entryDate,
    label: `${Number(r.entryDate.slice(8, 10))}일`,
    weightKg: r.weightKg,
  }));
}

const RANGE_OPTIONS: readonly { value: WeightRange; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "year", label: "년" },
  { value: "month", label: "월" },
];

/**
 * 순수 CSS/HTML 심플 체중 막대 그래프 (전체 | 년 | 월, 기본: 월 · 최대 12막대 자동 버킷팅)
 */
export function DailyWeightChart({
  todayStr,
  records,
  profileWeightKg,
}: {
  todayStr: string;
  records: WeightPoint[];
  profileWeightKg?: number | null;
}) {
  const [range, setRange] = useState<WeightRange>("month");
  const { ref: barScrollRef, dragProps: barDragProps } =
    useHorizontalDragScroll<HTMLDivElement>();

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => a.entryDate.localeCompare(b.entryDate)),
    [records],
  );

  const bars = useMemo(
    () => buildBars(sortedRecords, range, todayStr),
    [sortedRecords, range, todayStr],
  );

  const scale = useMemo(() => {
    if (bars.length === 0) return null;
    const weights = bars.map((b) => b.weightKg);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const span = max - min;
    const low = span < 0.05 ? min - 1 : Math.max(0, min - span * 0.35);
    const high = span < 0.05 ? max + 1 : max + span * 0.15;
    return { span, low, high };
  }, [bars]);

  const latestWeight =
    sortedRecords.length > 0
      ? sortedRecords[sortedRecords.length - 1]!.weightKg
      : profileWeightKg ?? null;

  if (sortedRecords.length === 0 || !scale) {
    return (
      <section className="rounded-2xl bg-surface-subtle p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold tracking-tight text-ink">체중</h2>
          {latestWeight != null && (
            <span className="text-sm font-extrabold tabular-nums text-brand-strong">
              {formatKg(latestWeight)} kg
            </span>
          )}
        </div>
        <p className="mt-4 py-4 text-center text-sm text-ink-muted">
          일상에서 체중을 기록하면 그래프가 표시돼요.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-surface-subtle p-4">
      {/* 상단 1줄: 체중 + 최근값 | 전체 · 년 · 월 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-bold tracking-tight text-ink">체중</h2>
          {latestWeight != null && (
            <span className="text-sm font-extrabold tabular-nums text-brand-strong">
              {formatKg(latestWeight)} kg
            </span>
          )}
        </div>

        <div
          role="tablist"
          aria-label="체중 그래프 기간 선택"
          className="inline-flex rounded-xl bg-surface p-0.5"
        >
          {RANGE_OPTIONS.map((opt) => {
            const active = range === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRange(opt.value)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "bg-ink font-bold text-surface"
                    : "font-normal text-ink hover:bg-ink/[0.04]",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 막대바 영역 */}
      <div
        ref={barScrollRef}
        {...barDragProps}
        className="no-scrollbar swipe-x mt-5 overflow-x-auto pb-0.5 cursor-grab active:cursor-grabbing"
      >
        <div
          className={cn(
            "flex items-end gap-2",
            bars.length <= 6 ? "w-full justify-around" : "min-w-max px-1",
          )}
        >
          {bars.map((bar, idx) => {
            const isLatest = idx === bars.length - 1;
            const heightPct =
              scale.span < 0.05
                ? 62
                : Math.round(
                    26 + ((bar.weightKg - scale.low) / (scale.high - scale.low)) * 74,
                  );

            return (
              <div
                key={bar.key}
                className={cn(
                  "flex flex-col items-center",
                  bars.length <= 6 ? "min-w-11 flex-1" : "w-11 shrink-0",
                )}
              >
                <span
                  className={cn(
                    "mb-1.5 text-xs tabular-nums",
                    isLatest ? "font-extrabold text-brand-strong" : "font-medium text-ink-muted",
                  )}
                >
                  {formatKg(bar.weightKg)}
                </span>

                <div className="flex h-24 w-full items-end justify-center">
                  <div
                    className={cn(
                      "w-6 rounded-t-lg transition-[height] duration-300",
                      isLatest ? "bg-brand" : "bg-brand/30",
                    )}
                    style={{ height: `${Math.max(22, Math.min(100, heightPct))}%` }}
                  />
                </div>

                <span
                  className={cn(
                    "mt-2 text-xs tabular-nums",
                    isLatest ? "font-bold text-ink" : "font-medium text-ink-muted",
                  )}
                >
                  {bar.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
