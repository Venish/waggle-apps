"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  NotebookPen,
  Settings,
  Syringe,
  X,
} from "lucide-react";
import { cn, PawStampIcon } from "@repo/ui";
import { formatDateDot } from "@/00_lib/formatDate";
import { useModalStore } from "@/01_store/web/useModalStore";
import { DailyEditorClient } from "@/components/web/DailyEditorClient";
import { DailyStickerIcon } from "@/components/web/DailyStickerIcon";
import { DailyWeightChart, type WeightPoint } from "@/components/web/DailyWeightChart";
import { VaccinationSheetClient } from "@/components/web/VaccinationSheetClient";
import { DogAvatar, EmptyStateCard } from "@/components/web/WebUiKit";
import { AppBadge, AppSegmented } from "@/components/web/ui";

export interface DailyDogOption {
  id: number;
  name: string;
  isPrimary: boolean;
  profileImage: string | null;
  weightKg: string | null;
  breedName: string | null;
}

export interface DailyStickerView {
  id: number;
  kind: string;
  note: string | null;
  photoUrl: string | null;
}

export interface DailyEntryView {
  id: number;
  dogId: number;
  entryDate: string; // YYYY-MM-DD
  walked: boolean;
  weightKg: string | null;
  photoUrls: string[];
  memo: string | null;
  stickers: DailyStickerView[];
}

export interface VaccinationView {
  id: number;
  dogId: number;
  vaccineId: number;
  vaccineName: string;
  administeredAt: string; // YYYY-MM-DD
  nextDueAt: string | null;
  hospital: string | null;
  memo: string | null;
}

export type DailyMainTab = "daily" | "gallery" | "health";

interface GalleryPhotoItem {
  key: string;
  url: string;
  entryDate: string;
  monthKey: string; // YYYY-MM
  entry: DailyEntryView;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const STICKER_LABEL: Record<string, string> = {
  POOP: "배변",
  MEAL: "식사",
  MEDICINE: "투약",
  HOSPITAL: "병원",
  WALK: "산책",
  CUSTOM: "기타",
};

function formatDateKorean(ymd: string): string {
  const parts = ymd.split("-").map(Number);
  const y = parts[0] ?? 2026;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dow = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${dow})`;
}

function formatMonthKorean(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${y ?? 2026}년 ${m ?? 1}월`;
}

function formatMonthDayDot(ymd: string): string {
  const parts = ymd.split("-");
  return `${parts[1] ?? "01"}.${parts[2] ?? "01"}`;
}

function formatWeightText(val: string | null): string | null {
  if (!val) return null;
  const num = Number(val);
  if (!Number.isFinite(num)) return null;
  return `${Number.isInteger(num) ? num.toFixed(1) : Number(num.toFixed(2)).toString()} kg`;
}

function calcDDay(targetYmd: string, todayYmd: string): number {
  const [ty, tm, td] = targetYmd.split("-").map(Number);
  const [ny, nm, nd] = todayYmd.split("-").map(Number);
  const target = new Date(ty ?? 2026, (tm ?? 1) - 1, td ?? 1).getTime();
  const today = new Date(ny ?? 2026, (nm ?? 1) - 1, nd ?? 1).getTime();
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

export function DailyCalendarClient({
  todayStr,
  dogs,
  initialDogId,
  initialTab = "daily",
  entries,
  vaccines,
  vaccineOptions,
}: {
  todayStr: string;
  dogs: DailyDogOption[];
  initialDogId: number;
  initialTab?: DailyMainTab;
  entries: DailyEntryView[];
  vaccines: VaccinationView[];
  vaccineOptions: Array<{ id: number; name: string }>;
}) {
  const openModal = useModalStore((s) => s.openModal);
  const closeTopModal = useModalStore((s) => s.closeTopModal);

  const [initY, initM] = todayStr.split("-").map(Number);
  const [selectedDogId, setSelectedDogId] = useState(initialDogId);
  const [dogDropdownOpen, setDogDropdownOpen] = useState(false);
  const dogDropdownRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<DailyMainTab>(initialTab);
  const [viewYear, setViewYear] = useState(initY ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState((initM ?? new Date().getMonth() + 1) - 1);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // 풀스크린 좌우 스와이프 라이트박스 상태 (터치 + 마우스 드래그 공용)
  const [lightboxState, setLightboxState] = useState<{
    items: GalleryPhotoItem[];
    index: number;
  } | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const swipeRef = useRef<{ pointerId: number; startX: number; active: boolean } | null>(null);

  const selectedDog = dogs.find((d) => d.id === selectedDogId) ?? dogs[0]!;

  const dogEntries = useMemo(
    () => entries.filter((e) => e.dogId === selectedDogId),
    [entries, selectedDogId],
  );
  const dogVaccines = useMemo(
    () => vaccines.filter((v) => v.dogId === selectedDogId),
    [vaccines, selectedDogId],
  );

  const entryMap = useMemo(() => new Map(dogEntries.map((e) => [e.entryDate, e])), [dogEntries]);

  // 체중 기록 목록 (날짜 오름차순)
  const weightPoints: WeightPoint[] = useMemo(() => {
    const list: WeightPoint[] = [];
    for (const e of dogEntries) {
      if (!e.weightKg) continue;
      const n = Number(e.weightKg);
      if (Number.isFinite(n) && n > 0) {
        list.push({ entryDate: e.entryDate, weightKg: n });
      }
    }
    return list.sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  }, [dogEntries]);

  const latestWeightKg = useMemo(() => {
    if (weightPoints.length > 0) {
      return String(weightPoints[weightPoints.length - 1]!.weightKg);
    }
    return selectedDog.weightKg;
  }, [weightPoints, selectedDog.weightKg]);

  // 갤러리 사진 목록 (일상 photoUrls + 기존 스티커 photoUrl 하위 호환, 최신 날짜순)
  const galleryPhotos: GalleryPhotoItem[] = useMemo(() => {
    const sortedEntries = [...dogEntries].sort((a, b) =>
      b.entryDate.localeCompare(a.entryDate),
    );
    const items: GalleryPhotoItem[] = [];
    for (const entry of sortedEntries) {
      const seen = new Set<string>();
      for (const url of entry.photoUrls) {
        if (!url || seen.has(url)) continue;
        seen.add(url);
        items.push({
          key: `${entry.id}-${url}`,
          url,
          entryDate: entry.entryDate,
          monthKey: entry.entryDate.slice(0, 7),
          entry,
        });
      }
      for (const st of entry.stickers) {
        if (!st.photoUrl || seen.has(st.photoUrl)) continue;
        seen.add(st.photoUrl);
        items.push({
          key: `${entry.id}-st-${st.id}`,
          url: st.photoUrl,
          entryDate: entry.entryDate,
          monthKey: entry.entryDate.slice(0, 7),
          entry,
        });
      }
    }
    return items;
  }, [dogEntries]);

  // 갤러리 월별 그룹핑
  const galleryGroups = useMemo(() => {
    const map = new Map<string, GalleryPhotoItem[]>();
    for (const photo of galleryPhotos) {
      const arr = map.get(photo.monthKey) ?? [];
      arr.push(photo);
      map.set(photo.monthKey, arr);
    }
    return Array.from(map.entries());
  }, [galleryPhotos]);

  // 다가오는 다음 예방접종 우선 정렬 (예정일 임박순 → 최근 접종일순)
  const sortedDogVaccines = useMemo(() => {
    return [...dogVaccines].sort((a, b) => {
      const aUpcoming = Boolean(a.nextDueAt && a.nextDueAt >= todayStr);
      const bUpcoming = Boolean(b.nextDueAt && b.nextDueAt >= todayStr);
      if (aUpcoming && bUpcoming) {
        return a.nextDueAt!.localeCompare(b.nextDueAt!);
      }
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      return b.administeredAt.localeCompare(a.administeredAt);
    });
  }, [dogVaccines, todayStr]);

  // 반려견 DDL 외부 클릭 / ESC 닫기
  useEffect(() => {
    if (!dogDropdownOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (dogDropdownRef.current && !dogDropdownRef.current.contains(e.target as Node)) {
        setDogDropdownOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDogDropdownOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dogDropdownOpen]);

  // 라이트박스 키보드 네비게이션
  useEffect(() => {
    if (!lightboxState) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxState(null);
      } else if (e.key === "ArrowLeft") {
        setLightboxState((prev) =>
          prev && prev.index > 0 ? { ...prev, index: prev.index - 1 } : prev,
        );
      } else if (e.key === "ArrowRight") {
        setLightboxState((prev) =>
          prev && prev.index < prev.items.length - 1
            ? { ...prev, index: prev.index + 1 }
            : prev,
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxState]);

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const selectDateAndSyncMonth = (ymd: string) => {
    const [y, m] = ymd.split("-").map(Number);
    if (y && m) {
      setViewYear(y);
      setViewMonth(m - 1);
    }
    setSelectedDate(ymd);
  };

  const jumpToday = () => {
    selectDateAndSyncMonth(todayStr);
  };

  const openLightboxForEntry = (entry: DailyEntryView, targetUrl: string) => {
    const entryPhotos: GalleryPhotoItem[] = [];
    const seen = new Set<string>();
    for (const url of entry.photoUrls) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      entryPhotos.push({
        key: `${entry.id}-${url}`,
        url,
        entryDate: entry.entryDate,
        monthKey: entry.entryDate.slice(0, 7),
        entry,
      });
    }
    for (const st of entry.stickers) {
      if (!st.photoUrl || seen.has(st.photoUrl)) continue;
      seen.add(st.photoUrl);
      entryPhotos.push({
        key: `${entry.id}-st-${st.id}`,
        url: st.photoUrl,
        entryDate: entry.entryDate,
        monthKey: entry.entryDate.slice(0, 7),
        entry,
      });
    }
    const idx = Math.max(
      0,
      entryPhotos.findIndex((p) => p.url === targetUrl),
    );
    if (entryPhotos.length > 0) {
      setDragOffsetX(0);
      setLightboxState({ items: entryPhotos, index: idx });
    }
  };

  const openDailyEditorSheet = (targetDate: string) => {
    const entry = entryMap.get(targetDate) ?? null;
    openModal({
      id: `daily-editor-${selectedDogId}-${targetDate}`,
      title: `${formatDateKorean(targetDate)} ${entry ? "기록 수정" : "기록 작성"}`,
      subtitle: selectedDog.name,
      direction: "slide-up",
      stickyFooter: true,
      content: (
        <DailyEditorClient
          dogId={selectedDogId}
          entryDate={targetDate}
          initialEntry={entry}
          latestWeightKg={latestWeightKg}
          onSaved={closeTopModal}
        />
      ),
    });
  };

  const openVaccinationSheet = (record?: VaccinationView) => {
    openModal({
      id: record ? `vaccine-edit-${record.id}` : `vaccine-new-${selectedDogId}`,
      title: record ? "예방접종 기록 수정" : "예방접종 기록 추가",
      subtitle: selectedDog.name,
      direction: "slide-up",
      stickyFooter: true,
      content: (
        <VaccinationSheetClient
          dogId={selectedDogId}
          dogs={dogs.map((d) => ({ id: d.id, name: d.name }))}
          defaultDate={todayStr}
          vaccineOptions={vaccineOptions}
          initialRecord={record ?? null}
          onSaved={closeTopModal}
        />
      ),
    });
  };

  const handleFabClick = () => {
    if (activeTab === "daily") {
      openDailyEditorSheet(selectedDate);
    } else if (activeTab === "health") {
      openVaccinationSheet();
    }
  };

  const handleLightboxPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!lightboxState || lightboxState.items.length <= 1) return;
    if ((e.target as HTMLElement).closest("button")) return;
    swipeRef.current = { pointerId: e.pointerId, startX: e.clientX, active: true };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleLightboxPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!swipe?.active || !lightboxState) return;
    let dx = e.clientX - swipe.startX;
    // 첫 장/마지막 장에서 바깥 방향은 러버밴드 저항 적용
    if (
      (lightboxState.index === 0 && dx > 0) ||
      (lightboxState.index === lightboxState.items.length - 1 && dx < 0)
    ) {
      dx *= 0.28;
    }
    setDragOffsetX(dx);
  };

  const finishLightboxSwipe = (e: React.PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!swipe?.active || !lightboxState) return;
    swipeRef.current = null;
    if (e.currentTarget.hasPointerCapture(swipe.pointerId)) {
      e.currentTarget.releasePointerCapture(swipe.pointerId);
    }
    const rawDx = e.clientX - swipe.startX;
    if (rawDx > 48 && lightboxState.index > 0) {
      setLightboxState((prev) =>
        prev ? { ...prev, index: prev.index - 1 } : null,
      );
    } else if (rawDx < -48 && lightboxState.index < lightboxState.items.length - 1) {
      setLightboxState((prev) =>
        prev ? { ...prev, index: prev.index + 1 } : null,
      );
    }
    setDragOffsetX(0);
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const isViewingTodayMonth =
    viewYear === (initY ?? new Date().getFullYear()) &&
    viewMonth === (initM ?? new Date().getMonth() + 1) - 1;

  const selectedEntry = entryMap.get(selectedDate) ?? null;
  const activeWeightText = formatWeightText(latestWeightKg);
  const selectedEntryPhotos = useMemo(
    () => (selectedEntry ? selectedEntry.photoUrls : []),
    [selectedEntry],
  );

  const activeLightboxItem = lightboxState
    ? (lightboxState.items[lightboxState.index] ?? null)
    : null;

  return (
    <>
      <div className="waggle-stagger flex flex-1 flex-col space-y-5 pb-24">
        {/* 상단 반려견 프로필 스위처 (1마리: 관리 링크 / 다견: 1줄 통일 인라인 DDL) */}
        <section className="space-y-3">
          {dogs.length === 1 ? (
            <Link
              href="/app/my/dogs"
              className="flex items-center gap-3.5 rounded-2xl bg-surface-subtle px-4 py-3 transition-colors hover:bg-ink/[0.05] active:scale-[0.99]"
            >
              <DogAvatar
                src={selectedDog.profileImage}
                name={selectedDog.name}
                size="md"
                shape="squircle"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-base font-extrabold tracking-tight text-ink">
                    {selectedDog.name}
                  </p>
                  {activeWeightText && (
                    <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold tabular-nums text-ink-muted">
                      {activeWeightText}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-ink-muted">
                  {selectedDog.breedName ?? "우리 반려견"}의 일상 · 건강 기록
                </p>
              </div>
              <ChevronRight className="size-4.5 shrink-0 text-ink-muted" strokeWidth={2} />
            </Link>
          ) : (
            <div ref={dogDropdownRef} className="relative">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={dogDropdownOpen}
                onClick={() => setDogDropdownOpen((prev) => !prev)}
                className="flex w-full items-center gap-3.5 rounded-2xl bg-surface-subtle px-4 py-3 text-left transition-colors hover:bg-ink/[0.05] active:scale-[0.99]"
              >
                <DogAvatar
                  src={selectedDog.profileImage}
                  name={selectedDog.name}
                  size="md"
                  shape="squircle"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-base font-extrabold tracking-tight text-ink">
                      {selectedDog.name}
                    </p>
                    {activeWeightText && (
                      <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold tabular-nums text-ink-muted">
                        {activeWeightText}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">
                    {selectedDog.breedName ?? "우리 반려견"}의 일상 · 건강 기록
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "size-4.5 shrink-0 text-ink-muted transition-transform duration-200",
                    dogDropdownOpen && "rotate-180 text-ink",
                  )}
                  strokeWidth={2}
                />
              </button>

              {dogDropdownOpen && (
                <div
                  role="listbox"
                  aria-label="반려견 선택"
                  className="animate-fade-in absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-lg"
                >
                  <div className="max-h-64 overflow-y-auto py-1">
                    {dogs.map((d) => {
                      const isActive = d.id === selectedDogId;
                      const dogWeight = formatWeightText(d.weightKg);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onClick={() => {
                            setSelectedDogId(d.id);
                            setDogDropdownOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                            isActive ? "bg-brand-soft/60" : "hover:bg-surface-subtle",
                          )}
                        >
                          <DogAvatar
                            src={d.profileImage}
                            name={d.name}
                            size="sm"
                            shape="squircle"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-bold text-ink">
                                {d.name}
                              </span>
                              {dogWeight && (
                                <span className="text-xs font-medium tabular-nums text-ink-muted">
                                  {dogWeight}
                                </span>
                              )}
                            </div>
                            {d.breedName && (
                              <p className="truncate text-xs text-ink-muted">{d.breedName}</p>
                            )}
                          </div>
                          {isActive && (
                            <Check
                              className="size-4 shrink-0 text-brand-strong"
                              strokeWidth={2.4}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <Link
                    href="/app/my/dogs"
                    onClick={() => setDogDropdownOpen(false)}
                    className="flex items-center justify-between border-t border-border-subtle px-3.5 py-2.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
                  >
                    <span className="flex items-center gap-1.5">
                      <Settings className="size-3.5" strokeWidth={2} />
                      내 반려견 관리
                    </span>
                    <ChevronRight className="size-3.5" strokeWidth={2} />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* 공용 3탭 세그먼트 네비게이션 (text-sm 통일 · 슬라이딩 thumb) */}
          <AppSegmented
            asTabs
            ariaLabel="일상 관리 메뉴"
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: "daily", label: "일상" },
              { value: "gallery", label: "갤러리", count: galleryPhotos.length },
              { value: "health", label: "건강 · 접종" },
            ]}
          />
        </section>

        {/* ========== TAB 1: 일상 (화면 = 읽기 전용 · FAB = 등록/수정/삭제) ========== */}
        {activeTab === "daily" && (
          <div className="flex flex-1 flex-col space-y-5">
            {/* 월별 캘린더 */}
            <section className="space-y-3">
              <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="이전 달"
                  className="flex size-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink active:scale-95"
                >
                  <ChevronLeft className="size-5" strokeWidth={2} />
                </button>

                <div className="flex items-center justify-center gap-2">
                  <p className="text-base font-extrabold tracking-tight tabular-nums text-ink">
                    {viewYear}년 {viewMonth + 1}월
                  </p>
                  {(!isViewingTodayMonth || selectedDate !== todayStr) && (
                    <button
                      type="button"
                      onClick={jumpToday}
                      className="rounded-lg bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-strong transition-opacity active:opacity-70"
                    >
                      오늘
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="다음 달"
                  className="ml-auto flex size-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink active:scale-95"
                >
                  <ChevronRight className="size-5" strokeWidth={2} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-y-1.5 text-center">
                {WEEKDAYS.map((d, idx) => (
                  <div
                    key={d}
                    className={cn(
                      "py-1 text-xs font-medium",
                      idx === 0 ? "text-destructive/80" : "text-ink-muted",
                    )}
                  >
                    {d}
                  </div>
                ))}
                {Array.from({ length: firstDayOfWeek }, (_, i) => (
                  <div key={`empty-${i}`} aria-hidden="true" className="h-11" />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const hasRecord = entryMap.has(dateStr);
                  const isSelected = dateStr === selectedDate;
                  const isToday = dateStr === todayStr;
                  const dow = (firstDayOfWeek + i) % 7;

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedDate(dateStr)}
                      className={cn(
                        "relative mx-auto flex size-11 items-center justify-center rounded-full text-base tabular-nums transition-colors active:scale-95",
                        isSelected
                          ? "bg-brand font-extrabold text-surface"
                          : isToday && !hasRecord
                            ? "font-bold text-brand-strong ring-1.5 ring-brand"
                            : hasRecord
                              ? "font-extrabold text-ink hover:bg-surface-subtle"
                              : dow === 0
                                ? "font-medium text-destructive/85 hover:bg-surface-subtle"
                                : "font-medium text-ink hover:bg-surface-subtle",
                      )}
                    >
                      {hasRecord && (
                        <PawStampIcon
                          ringOpacity={isSelected ? 0 : 0.85}
                          pawFill={isSelected ? "currentColor" : "#B4EFCA"}
                          pawOpacity={isSelected ? 0.28 : 1}
                          className={cn(
                            "pointer-events-none absolute inset-0 z-0 size-full",
                            isSelected ? "text-surface" : "text-brand",
                          )}
                        />
                      )}
                      <span className="relative z-10">{day}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 선택 날짜 기록 본문 (1줄 헤더 + 풀폭 읽기) */}
            <section className="flex flex-1 flex-col space-y-4 border-t border-border-subtle pt-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {selectedDate === todayStr && (
                    <span
                      aria-label="오늘"
                      title="오늘"
                      className="size-2 shrink-0 rounded-full bg-brand"
                    />
                  )}
                  <h2 className="truncate text-base font-bold tracking-tight tabular-nums text-ink">
                    {formatDateKorean(selectedDate)}
                  </h2>
                </div>

                {selectedEntry &&
                  (selectedEntry.walked || formatWeightText(selectedEntry.weightKg)) && (
                    <div className="flex shrink-0 items-center gap-2">
                      {selectedEntry.walked && (
                        <span
                          role="img"
                          aria-label="산책 완료"
                          title="산책 완료"
                          className="inline-flex shrink-0 items-center justify-center"
                        >
                          <PawStampIcon
                            ringOpacity={0.85}
                            pawOpacity={0.9}
                            className="size-7 text-brand"
                          />
                        </span>
                      )}
                      {formatWeightText(selectedEntry.weightKg) && (
                        <AppBadge tone="neutral" size="md" className="tabular-nums">
                          체중 {formatWeightText(selectedEntry.weightKg)}
                        </AppBadge>
                      )}
                    </div>
                  )}
              </div>

              {!selectedEntry ? (
                <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                  <p className="text-sm font-medium text-ink-muted">
                    {formatDateKorean(selectedDate)} 기록이 아직 없어요.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 다중 사진 그리드 (풀폭 · 클릭 시 좌우 스와이프 라이트박스) */}
                  {selectedEntryPhotos.length > 0 && (
                    <div
                      className={cn(
                        "grid gap-2",
                        selectedEntryPhotos.length === 1
                          ? "grid-cols-1"
                          : selectedEntryPhotos.length === 2
                            ? "grid-cols-2"
                            : "grid-cols-3",
                      )}
                    >
                      {selectedEntryPhotos.map((url, idx) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => openLightboxForEntry(selectedEntry, url)}
                          className={cn(
                            "overflow-hidden rounded-2xl bg-surface-subtle transition-opacity active:opacity-80",
                            selectedEntryPhotos.length === 1
                              ? "aspect-[16/10]"
                              : "aspect-square",
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`${formatDateKorean(selectedDate)} 일상 사진 ${idx + 1}`}
                            className="size-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 일기 본문 전문 */}
                  {selectedEntry.memo && (
                    <p className="whitespace-pre-wrap text-base leading-relaxed text-ink">
                      {selectedEntry.memo}
                    </p>
                  )}

                  {/* 컬러 스티커 목록 (사진은 우측 끝 1줄 컴팩트 배치) */}
                  {selectedEntry.stickers.length > 0 && (
                    <ul className="space-y-2 pt-1">
                      {selectedEntry.stickers.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center gap-3 rounded-2xl bg-surface-subtle px-3.5 py-2.5 text-sm text-ink"
                        >
                          <DailyStickerIcon kind={s.kind} className="size-5" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-ink">
                              {STICKER_LABEL[s.kind] ?? s.kind}
                            </p>
                            {s.note && (
                              <p className="mt-0.5 break-words text-sm leading-snug text-ink-muted">
                                {s.note}
                              </p>
                            )}
                          </div>
                          {s.photoUrl && (
                            <button
                              type="button"
                              onClick={() => openLightboxForEntry(selectedEntry, s.photoUrl!)}
                              className="size-12 shrink-0 overflow-hidden rounded-xl bg-surface transition-opacity active:opacity-80"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={s.photoUrl}
                                alt={`${STICKER_LABEL[s.kind] ?? s.kind} 사진`}
                                className="size-full object-cover"
                              />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ========== TAB 2: 갤러리 (순수 모아보기 · FAB 없음 · Empty vcenter) ========== */}
        {activeTab === "gallery" && (
          <div className="flex flex-1 flex-col space-y-6">
            {galleryPhotos.length === 0 ? (
              <EmptyStateCard
                mode="page"
                icon={<ImageIcon className="size-5.5" strokeWidth={1.7} />}
                title="아직 모인 사진이 없어요"
                description="일상에 남긴 사진들이 여기에 모여요."
              />
            ) : (
              galleryGroups.map(([ym, photos]) => (
                <section key={ym} className="space-y-2.5">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-sm font-bold tracking-tight tabular-nums text-ink">
                      {formatMonthKorean(ym)}
                    </h2>
                    <span className="text-xs font-semibold tabular-nums text-ink-muted">
                      {photos.length}장
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {photos.map((photo) => {
                      const globalIndex = galleryPhotos.findIndex(
                        (p) => p.key === photo.key,
                      );
                      return (
                        <button
                          key={photo.key}
                          type="button"
                          onClick={() => {
                            setDragOffsetX(0);
                            setLightboxState({
                              items: galleryPhotos,
                              index: Math.max(0, globalIndex),
                            });
                          }}
                          className="group relative aspect-square overflow-hidden rounded-xl bg-surface-subtle transition-transform active:scale-[0.97]"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.url}
                            alt={`${formatDateKorean(photo.entryDate)} 사진`}
                            loading="lazy"
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-ink/65 px-1.5 py-0.5 text-2xs font-bold tabular-nums text-surface backdrop-blur-xs">
                            {formatMonthDayDot(photo.entryDate)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        )}

        {/* ========== TAB 3: 건강 · 접종 ========== */}
        {activeTab === "health" && (
          <div className="flex flex-1 flex-col space-y-6">
            {/* 체중 변화 순수 CSS 막대 그래프 */}
            <DailyWeightChart
              todayStr={todayStr}
              records={weightPoints}
              profileWeightKg={
                selectedDog.weightKg ? Number(selectedDog.weightKg) : null
              }
            />

            {/* 예방접종 섹션 */}
            <section className="flex flex-1 flex-col space-y-3 border-t border-border-subtle pt-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-bold tracking-tight text-ink">
                  <Syringe className="size-4 text-brand" strokeWidth={2} />
                  예방접종 기록
                </h2>
                {dogVaccines.length > 0 && (
                  <span className="text-xs font-medium tabular-nums text-ink-muted">
                    총 {dogVaccines.length}건
                  </span>
                )}
              </div>

              {sortedDogVaccines.length === 0 ? (
                <EmptyStateCard
                  mode="section"
                  icon={<Syringe className="size-5.5" strokeWidth={1.7} />}
                  title="등록된 예방접종 기록이 없어요"
                  description="접종 이력과 다음 예정일을 기록해 관리해 보세요."
                />
              ) : (
                <ul className="divide-y divide-border-subtle border-y border-border-subtle">
                  {sortedDogVaccines.map((v) => {
                    const dDay =
                      v.nextDueAt && v.nextDueAt >= todayStr
                        ? calcDDay(v.nextDueAt, todayStr)
                        : null;
                    return (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => openVaccinationSheet(v)}
                          className="flex w-full items-center justify-between gap-3 py-3.5 text-left transition-colors hover:bg-surface-subtle/60 active:bg-surface-subtle"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate text-sm font-bold text-ink">
                                  {v.vaccineName}
                                </span>
                                {dDay !== null && (
                                  <AppBadge tone="brand" className="shrink-0 tabular-nums">
                                    {dDay === 0 ? "D-DAY" : `D-${dDay}`}
                                  </AppBadge>
                                )}
                              </div>
                              <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                                {formatDateDot(v.administeredAt)}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs text-ink-muted">
                              {v.hospital ?? "병원 미입력"}
                              {v.nextDueAt ? ` · 다음 예정 ${formatDateDot(v.nextDueAt)}` : ""}
                            </p>
                            {v.memo && (
                              <p className="mt-1 line-clamp-1 text-xs text-ink-muted/85">
                                {v.memo}
                              </p>
                            )}
                          </div>
                          <ChevronRight
                            className="size-4 shrink-0 text-ink-muted"
                            strokeWidth={2}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>

      {/* 단일 컨텍스트 원형 FAB (갤러리 탭에서는 숨김 · 일상/건강 탭 전용) */}
      {activeTab !== "gallery" && (
        <div className="pointer-events-none fixed bottom-22 left-1/2 z-20 flex w-full max-w-app -translate-x-1/2 justify-end px-4">
          <button
            type="button"
            onClick={handleFabClick}
            aria-label={
              activeTab === "daily"
                ? selectedEntry
                  ? "일상 기록 수정"
                  : "일상 기록 작성"
                : "예방접종 기록 추가"
            }
            className="pointer-events-auto relative flex size-13 items-center justify-center rounded-full bg-brand text-surface shadow-lg transition-transform duration-150 hover:opacity-95 active:scale-[0.93]"
          >
            {activeTab === "daily" ? (
              <NotebookPen className="size-5.5" strokeWidth={2.2} />
            ) : (
              <Syringe className="size-5.5" strokeWidth={2.2} />
            )}
          </button>
        </div>
      )}

      {/* 풀스크린 좌우 스와이프 사진 라이트박스 (document.body 포털 · 터치+마우스 드래그 지원) */}
      {lightboxState &&
        activeLightboxItem &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="일상 사진 크게 보기"
            className="fixed inset-0 z-[80] flex flex-col overscroll-contain bg-ink/95 text-surface select-none"
          >
            {/* 상단 바 */}
            <div className="mx-auto flex w-full max-w-app items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tabular-nums">
                  {formatDateKorean(activeLightboxItem.entryDate)}
                </span>
                <span className="rounded-full bg-surface/15 px-2 py-0.5 text-xs font-semibold tabular-nums">
                  {lightboxState.index + 1} / {lightboxState.items.length}
                </span>
              </div>
              <button
                type="button"
                aria-label="사진 닫기"
                onClick={() => setLightboxState(null)}
                className="flex size-9 items-center justify-center rounded-full bg-surface/15 text-surface transition-colors hover:bg-surface/25 active:scale-95"
              >
                <X className="size-5" strokeWidth={2.2} />
              </button>
            </div>

            {/* 중앙 스와이프 이미지 뷰포트 */}
            <div
              onPointerDown={handleLightboxPointerDown}
              onPointerMove={handleLightboxPointerMove}
              onPointerUp={finishLightboxSwipe}
              onPointerCancel={finishLightboxSwipe}
              className={cn(
                "relative mx-auto flex min-h-0 w-full max-w-app flex-1 items-center justify-center overflow-hidden px-3 touch-pan-y",
                lightboxState.items.length > 1 && "cursor-grab active:cursor-grabbing",
              )}
            >
              {lightboxState.index > 0 && (
                <button
                  type="button"
                  aria-label="이전 사진"
                  onClick={() =>
                    setLightboxState((prev) =>
                      prev ? { ...prev, index: prev.index - 1 } : null,
                    )
                  }
                  className="absolute left-3 z-10 flex size-9 items-center justify-center rounded-full bg-ink/55 text-surface backdrop-blur-xs transition-opacity hover:bg-ink/75 active:scale-95"
                >
                  <ChevronLeft className="size-5" strokeWidth={2.2} />
                </button>
              )}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeLightboxItem.url}
                alt={`${formatDateKorean(activeLightboxItem.entryDate)} 일상 사진`}
                draggable={false}
                style={{
                  transform: `translate3d(${dragOffsetX}px, 0, 0)`,
                  transition: dragOffsetX === 0 ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
                }}
                className="pointer-events-none max-h-full max-w-full rounded-2xl object-contain"
              />

              {lightboxState.index < lightboxState.items.length - 1 && (
                <button
                  type="button"
                  aria-label="다음 사진"
                  onClick={() =>
                    setLightboxState((prev) =>
                      prev ? { ...prev, index: prev.index + 1 } : null,
                    )
                  }
                  className="absolute right-3 z-10 flex size-9 items-center justify-center rounded-full bg-ink/55 text-surface backdrop-blur-xs transition-opacity hover:bg-ink/75 active:scale-95"
                >
                  <ChevronRight className="size-5" strokeWidth={2.2} />
                </button>
              )}
            </div>

            {/* 하단 요약 + 이 날 일기 보기 (일상 탭 해당 날짜로 바로 이동) */}
            <div className="mx-auto w-full max-w-app space-y-2.5 px-4 pt-3 pb-5 pb-safe-bottom">
              {lightboxState.items.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 pb-1">
                  {lightboxState.items.slice(0, 10).map((item, idx) => (
                    <span
                      key={item.key}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        idx === lightboxState.index
                          ? "w-4 bg-surface"
                          : "w-1.5 bg-surface/35",
                      )}
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-surface/80">
                    {activeLightboxItem.entry.walked && <span>산책 완료</span>}
                    {activeLightboxItem.entry.walked &&
                      activeLightboxItem.entry.weightKg && <span>·</span>}
                    {formatWeightText(activeLightboxItem.entry.weightKg) && (
                      <span className="tabular-nums">
                        {formatWeightText(activeLightboxItem.entry.weightKg)}
                      </span>
                    )}
                  </div>
                  {activeLightboxItem.entry.memo && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-surface/90">
                      {activeLightboxItem.entry.memo}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const targetDate = activeLightboxItem.entryDate;
                    setLightboxState(null);
                    setActiveTab("daily");
                    selectDateAndSyncMonth(targetDate);
                  }}
                  className="shrink-0 rounded-full bg-surface px-3.5 py-2 text-xs font-bold text-ink transition-opacity active:opacity-80"
                >
                  이 날 일기 보기
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
