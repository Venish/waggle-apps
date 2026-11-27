"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@repo/ui";
import { saveDailyGoalAction } from "@/03_actions/web/onboardingEducationActions";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import {
  AppButton,
  AppChip,
  AppSegmented,
  AppSwitch,
  AppTimePicker,
} from "@/components/web/ui";

const WEEKDAY_ITEMS = [
  { day: 0, label: "일" },
  { day: 1, label: "월" },
  { day: 2, label: "화" },
  { day: 3, label: "수" },
  { day: 4, label: "목" },
  { day: 5, label: "금" },
  { day: 6, label: "토" },
] as const;

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];

function sameDaySet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

function formatRepeatSummary(days: number[]): string {
  if (days.length === 0) return "요일을 선택해 주세요";
  if (sameDaySet(days, ALL_DAYS)) return "매일 반복";
  if (sameDaySet(days, WEEKDAYS)) return "주중 (월~금)";
  if (sameDaySet(days, WEEKENDS)) return "주말 (토·일)";
  const sorted = [...days].sort((a, b) => a - b);
  return `매주 ${sorted.map((d) => WEEKDAY_ITEMS[d]?.label).join("·")}`;
}

export function DailyGoalFormClient({
  initialGoal,
  initialEnabled,
  initialTime,
  initialDays = ALL_DAYS,
  completeOnboarding = false,
  redirectTo = "/app",
}: {
  initialGoal: number;
  initialEnabled: boolean;
  initialTime: string;
  initialDays?: number[];
  completeOnboarding?: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const [goal, setGoal] = useState<string>(String(initialGoal));
  const [enabled, setEnabled] = useState(initialEnabled);
  const [time, setTime] = useState(initialTime);
  const [days, setDays] = useState<number[]>(
    initialDays.length > 0 ? [...initialDays].sort((a, b) => a - b) : ALL_DAYS,
  );
  const [pending, setPending] = useState(false);

  const toggleDay = (d: number) => {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enabled && days.length === 0) {
      openAlert({ title: "반복할 요일을 최소 1개 이상 선택해 주세요" });
      return;
    }
    setPending(true);
    try {
      const res = await saveDailyGoalAction({
        dailyLessonGoal: Number(goal),
        reminderEnabled: enabled,
        reminderTime: time,
        reminderDays: days,
        completeOnboarding,
      });
      if (!res.ok) {
        openAlert({ title: "저장 실패", description: res.error.message, tone: "destructive" });
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <form noValidate onSubmit={handleSave} className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-xl font-extrabold tracking-tight text-ink">
          하루에 몇 개의 강의를 들을까요?
        </h2>

        <AppSegmented
          label="일일 학습량"
          value={goal}
          onChange={setGoal}
          options={[
            { value: "1", label: "1개 (5분)" },
            { value: "2", label: "2개 (10분)" },
            { value: "3", label: "3개 (15분)" },
          ]}
        />
      </section>

      <section className="space-y-5 border-t border-border-subtle pt-4">
        <AppSwitch
          checked={enabled}
          onChange={setEnabled}
          label="데일리 목표 리마인드 알림"
          description="목표를 달성하지 않은 날 지정한 시각에 알려드려요."
        />

        {enabled && (
          <div className="space-y-5">
            <AppTimePicker
              label="알림 발송 시각 (KST)"
              modalTitle="리마인드 알림 시각"
              value={time}
              onChange={setTime}
            />

            {/* iPhone 알람 스타일 반복 요일 선택 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-ink-muted">반복 요일</p>
                <span className="text-xs font-bold text-brand-strong">
                  {formatRepeatSummary(days)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <AppChip selected={sameDaySet(days, ALL_DAYS)} onClick={() => setDays(ALL_DAYS)}>
                  매일
                </AppChip>
                <AppChip selected={sameDaySet(days, WEEKDAYS)} onClick={() => setDays(WEEKDAYS)}>
                  주중
                </AppChip>
                <AppChip selected={sameDaySet(days, WEEKENDS)} onClick={() => setDays(WEEKENDS)}>
                  주말
                </AppChip>
              </div>

              <div
                className="grid grid-cols-7 place-items-center gap-1.5"
                role="group"
                aria-label="반복 요일 선택"
              >
                {WEEKDAY_ITEMS.map(({ day, label }) => {
                  const active = days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-full text-sm transition-[background-color,color,transform] duration-150 active:scale-[0.94]",
                        active
                          ? "bg-brand font-bold text-on-brand"
                          : day === 0
                            ? "bg-surface-subtle font-medium text-destructive/80 hover:bg-ink/[0.05]"
                            : "bg-surface-subtle font-medium text-ink-muted hover:bg-ink/[0.05] hover:text-ink",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      <AppButton type="submit" variant="primary" size="lg" fullWidth loading={pending}>
        {pending ? "저장 중..." : completeOnboarding ? "와글 교육 시작하기" : "데일리 목표 저장"}
      </AppButton>
    </form>
  );
}
