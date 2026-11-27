"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flag,
  Flame,
  GraduationCap,
  Lock,
  Medal,
  Settings,
  X,
} from "lucide-react";
import { cn, PawIcon } from "@repo/ui";
import { formatGradeLabel, type GradeTierPolicy } from "@repo/types";
import { formatDateDot } from "@/00_lib/formatDate";
import { updateCurrentNavHref } from "@/00_lib/mobileNavHistory";
import { DogAvatar, EmptyStateCard } from "@/components/web/WebUiKit";
import {
  AppButton,
  AppCenterModal,
  AppLink,
  AppSegmented,
} from "@/components/web/ui";

export type RecordMainTab = "growth" | "badges";

export interface RecordDogOption {
  id: number;
  name: string;
  isPrimary: boolean;
  grade: number;
  profileImage: string | null;
  breedName: string | null;
}

export interface RecordCourseProgressItem {
  dogId: number;
  courseId: number;
  courseCode: string;
  courseTitle: string;
  courseLevel: number;
  status: "IN_PROGRESS" | "COMPLETED";
  totalLessons: number;
  completedLessons: number;
  completedAt: string | null;
}

export interface RecordCompletedLessonItem {
  id: number;
  dogId: number;
  lessonId: number;
  lessonTitle: string;
  courseId: number;
  courseTitle: string;
  unitTitle: string;
  completedAt: string; // ISO
  completedDateKst: string; // YYYY-MM-DD (KST)
  completedVia: "NORMAL" | "LEVEL_TEST";
  quizScore: number | null;
  quizTotal: number | null;
}

export interface RecordBadgeMaster {
  id: number;
  code: string;
  kind: string;
  name: string;
  iconName: string;
  description: string | null;
}

export interface RecordEarnedBadge {
  dogId: number;
  badgeId: number;
  earnedAt: string; // ISO
}

export interface RecordUnitStat {
  dogId: number;
  unitId: number;
  totalLessons: number;
  completedLessons: number;
}

export interface RecordCourseCatalogBrief {
  courseId: number;
  courseCode: string;
  courseTitle: string;
  courseLevel: number;
  totalLessons: number;
}

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

interface GradeCardTheme {
  gradient: string;
  barFill: string;
  accentText: string;
  dotActive: string;
}

const GRADE_CARD_THEMES: Record<number, GradeCardTheme> = {
  1: {
    gradient: "waggle-pass-1",
    barFill: "bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-400",
    accentText: "text-emerald-700 dark:text-emerald-300",
    dotActive: "bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-400",
  },
  2: {
    gradient: "waggle-pass-2",
    barFill: "bg-gradient-to-r from-sky-400 via-emerald-400 to-rose-400",
    accentText: "text-sky-700 dark:text-sky-300",
    dotActive: "bg-gradient-to-r from-sky-400 via-emerald-400 to-rose-400",
  },
  3: {
    gradient: "waggle-pass-3",
    barFill: "bg-gradient-to-r from-amber-400 via-rose-400 to-emerald-400",
    accentText: "text-amber-700 dark:text-amber-300",
    dotActive: "bg-gradient-to-r from-amber-400 via-rose-400 to-emerald-400",
  },
  4: {
    gradient: "waggle-pass-4",
    barFill: "bg-gradient-to-r from-rose-400 via-amber-400 to-sky-400",
    accentText: "text-rose-700 dark:text-rose-300",
    dotActive: "bg-gradient-to-r from-rose-400 via-amber-400 to-sky-400",
  },
  5: {
    gradient: "waggle-pass-5",
    barFill: "bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400",
    accentText: "text-amber-700 dark:text-amber-300",
    dotActive: "bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400",
  },
};

function getGradeCardTheme(grade: number): GradeCardTheme {
  return GRADE_CARD_THEMES[grade] ?? GRADE_CARD_THEMES[1]!;
}

interface BadgeTheme {
  imageSrc?: string;
  iconColor: string;
  barFill: string;
  auraBg: string;
}

const DEFAULT_BADGE_THEME: BadgeTheme = {
  iconColor: "text-emerald-500",
  barFill: "bg-emerald-400",
  auraBg: "bg-emerald-500/12",
};

const BADGE_THEMES: Record<string, BadgeTheme> = {
  FIRST_LESSON: {
    imageSrc: "/images/badges/first-lesson.webp",
    iconColor: "text-emerald-500",
    barFill: "bg-emerald-400",
    auraBg: "bg-emerald-500/12",
  },
  WELCOME_WAGGLE: {
    imageSrc: "/images/badges/welcome-waggle.webp",
    iconColor: "text-amber-500",
    barFill: "bg-amber-400",
    auraBg: "bg-amber-500/12",
  },
  UNIT_MASTER: {
    imageSrc: "/images/badges/unit-master.webp",
    iconColor: "text-rose-500",
    barFill: "bg-rose-400",
    auraBg: "bg-rose-500/12",
  },
  COURSE_PUPPY_BASIC: {
    imageSrc: "/images/badges/course-puppy-basic.webp",
    iconColor: "text-sky-500",
    barFill: "bg-sky-400",
    auraBg: "bg-sky-500/12",
  },
  COURSE_WALK_MANNER: {
    imageSrc: "/images/badges/course-walk-manner.webp",
    iconColor: "text-teal-500",
    barFill: "bg-teal-400",
    auraBg: "bg-teal-500/12",
  },
  STREAK_5: {
    imageSrc: "/images/badges/streak-5.webp",
    iconColor: "text-orange-500",
    barFill: "bg-orange-400",
    auraBg: "bg-orange-500/12",
  },
};

function getBadgeTheme(code: string): BadgeTheme {
  return BADGE_THEMES[code] ?? DEFAULT_BADGE_THEME;
}

function renderBadgeIcon(code: string, iconName: string, className: string) {
  // Sparkles 및 유사 반짝이 아이콘 사용 금지 정책 준수
  switch (code) {
    case "FIRST_LESSON":
      return <Flag className={cn("size-7", className)} strokeWidth={2} />;
    case "UNIT_MASTER":
      return <Award className={cn("size-7", className)} strokeWidth={2} />;
    case "COURSE_PUPPY_BASIC":
      return <GraduationCap className={cn("size-7", className)} strokeWidth={2} />;
    case "COURSE_WALK_MANNER":
      return <PawIcon className={cn("size-7", className)} />;
    case "STREAK_5":
      return <Flame className={cn("size-7", className)} strokeWidth={2} />;
    case "WELCOME_WAGGLE":
      return <Medal className={cn("size-7", className)} strokeWidth={2} />;
    default:
      if (iconName === "GraduationCap") {
        return <GraduationCap className={cn("size-7", className)} strokeWidth={2} />;
      }
      if (iconName === "Footprints") {
        return <PawIcon className={cn("size-7", className)} />;
      }
      if (iconName === "Flame") {
        return <Flame className={cn("size-7", className)} strokeWidth={2} />;
      }
      return <Award className={cn("size-7", className)} strokeWidth={2} />;
  }
}

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + delta));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function getIsoWeekdayMon0(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay(); // 0=Sun..6=Sat
  return (dow + 6) % 7; // 0=Mon..6=Sun
}

function computeStreakDays(activityDates: ReadonlySet<string>, todayYmd: string): number {
  if (activityDates.size === 0) return 0;
  let cursor = activityDates.has(todayYmd)
    ? todayYmd
    : activityDates.has(addDaysYmd(todayYmd, -1))
      ? addDaysYmd(todayYmd, -1)
      : null;
  if (!cursor) return 0;

  let streak = 0;
  while (activityDates.has(cursor)) {
    streak += 1;
    cursor = addDaysYmd(cursor, -1);
  }
  return streak;
}

export function RecordHubClient({
  dogs,
  initialDogId,
  initialTab,
  todayStr,
  gradeTiers,
  courseProgresses,
  completedLessons,
  activityDatesByDog,
  unitStats,
  courseCatalog,
  allBadges,
  earnedBadges,
}: {
  dogs: RecordDogOption[];
  initialDogId: number;
  initialTab: RecordMainTab;
  todayStr: string;
  gradeTiers: GradeTierPolicy[];
  courseProgresses: RecordCourseProgressItem[];
  completedLessons: RecordCompletedLessonItem[];
  activityDatesByDog: Record<number, string[]>;
  unitStats: RecordUnitStat[];
  courseCatalog: RecordCourseCatalogBrief[];
  allBadges: RecordBadgeMaster[];
  earnedBadges: RecordEarnedBadge[];
}) {
  const [selectedDogId, setSelectedDogId] = useState(initialDogId);
  const [activeTab, setActiveTab] = useState<RecordMainTab>(initialTab);
  const [dogDropdownOpen, setDogDropdownOpen] = useState(false);
  const [showAllLessons, setShowAllLessons] = useState(false);
  const [viewingGradeIdx, setViewingGradeIdx] = useState(0);
  const [selectedBadgeId, setSelectedBadgeId] = useState<number | null>(null);
  const dogDropdownRef = useRef<HTMLDivElement>(null);
  const gradeTrackRef = useRef<HTMLDivElement>(null);
  const gradeDragRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    startIdx: number;
  }>({ active: false, pointerId: -1, startX: 0, startScrollLeft: 0, startIdx: 0 });

  const selectedDog = dogs.find((d) => d.id === selectedDogId) ?? dogs[0]!;

  useEffect(() => {
    const qs = new URLSearchParams();
    if (activeTab === "badges") qs.set("tab", "badges");
    if (selectedDogId !== initialDogId) qs.set("dogId", String(selectedDogId));
    const suffix = qs.toString();
    updateCurrentNavHref("/app/record", suffix ? `/app/record?${suffix}` : "/app/record");
  }, [activeTab, selectedDogId, initialDogId]);
  const sortedTiers = useMemo(
    () => [...gradeTiers].sort((a, b) => a.grade - b.grade),
    [gradeTiers],
  );
  const currentTierIndex = Math.max(
    0,
    sortedTiers.findIndex((t) => t.grade === selectedDog.grade),
  );

  // 특정 학년 카드로 부드럽게 스와이프 스크롤
  const scrollToGradeIndex = useCallback((idx: number, behavior: ScrollBehavior = "smooth") => {
    const track = gradeTrackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(track.children.length - 1, idx));
    const card = track.children[clamped] as HTMLElement | undefined;
    if (!card) return;
    const left = Math.max(0, card.offsetLeft - 16);
    track.scrollTo({ left, behavior });
    setViewingGradeIdx(clamped);
  }, []);

  // 마우스 드래그 스와이프: 36px 이상 드래그하면 원래 카드로 되돌아가지 않고 다음/이전 카드로 즉시 전환
  const handleGradePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const track = gradeTrackRef.current;
    if (!track) return;
    gradeDragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startScrollLeft: track.scrollLeft,
      startIdx: viewingGradeIdx,
    };
    track.style.scrollSnapType = "none";
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleGradePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = gradeDragRef.current;
    if (!drag.active || e.pointerType !== "mouse") return;
    const track = gradeTrackRef.current;
    if (!track) return;
    const dx = e.clientX - drag.startX;
    track.scrollLeft = drag.startScrollLeft - dx;
  };

  const handleGradePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = gradeDragRef.current;
    if (!drag.active) return;
    gradeDragRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(drag.pointerId)) {
      e.currentTarget.releasePointerCapture(drag.pointerId);
    }
    const track = gradeTrackRef.current;
    if (!track) return;
    const dx = e.clientX - drag.startX;
    let targetIdx = drag.startIdx;
    if (dx <= -36) {
      targetIdx = Math.min(sortedTiers.length - 1, drag.startIdx + 1);
    } else if (dx >= 36) {
      targetIdx = Math.max(0, drag.startIdx - 1);
    }
    scrollToGradeIndex(targetIdx, "smooth");
    window.setTimeout(() => {
      if (gradeTrackRef.current && !gradeDragRef.current.active) {
        gradeTrackRef.current.style.scrollSnapType = "";
      }
    }, 320);
  };

  // 반려견 전환 시 이수 내역 펼침 초기화
  useEffect(() => {
    setShowAllLessons(false);
  }, [selectedDogId]);

  // 학년·배지 탭 진입 또는 반려견 전환 시 내 학년 카드로 자동 포커스
  useEffect(() => {
    if (activeTab !== "badges") return;
    setViewingGradeIdx(currentTierIndex);
    const raf = requestAnimationFrame(() => {
      scrollToGradeIndex(currentTierIndex, "auto");
    });
    return () => cancelAnimationFrame(raf);
  }, [activeTab, currentTierIndex, scrollToGradeIndex]);

  // 가로 스와이프 시 현재 보고 있는 학년 카드 인덱스 동기화
  const handleGradeTrackScroll = () => {
    const track = gradeTrackRef.current;
    if (!track || track.children.length === 0) return;
    const targetLeft = track.scrollLeft + 24;
    let closest = 0;
    let minDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < track.children.length; i += 1) {
      const child = track.children[i] as HTMLElement;
      const dist = Math.abs(child.offsetLeft - targetLeft);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    setViewingGradeIdx(closest);
  };

  // 다견 DDL 외부 클릭 / ESC 닫기
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

  const dogCourses = useMemo(
    () =>
      courseProgresses
        .filter((c) => c.dogId === selectedDogId)
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === "IN_PROGRESS" ? -1 : 1;
          return a.courseLevel - b.courseLevel;
        }),
    [courseProgresses, selectedDogId],
  );

  const dogLessons = useMemo(
    () =>
      completedLessons
        .filter((l) => l.dogId === selectedDogId)
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
    [completedLessons, selectedDogId],
  );

  const dogEarnedMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const eb of earnedBadges) {
      if (eb.dogId === selectedDogId) map.set(eb.badgeId, eb.earnedAt);
    }
    return map;
  }, [earnedBadges, selectedDogId]);

  const dogUnitStats = useMemo(
    () => unitStats.filter((u) => u.dogId === selectedDogId),
    [unitStats, selectedDogId],
  );

  const activitySet = useMemo(
    () => new Set(activityDatesByDog[selectedDogId] ?? []),
    [activityDatesByDog, selectedDogId],
  );

  // 이번 주(월~일) 7일 학습 리듬 & 연속 학습일
  const weekDays = useMemo(() => {
    const monOffset = getIsoWeekdayMon0(todayStr);
    const mondayYmd = addDaysYmd(todayStr, -monOffset);
    return WEEKDAY_LABELS.map((label, idx) => {
      const ymd = addDaysYmd(mondayYmd, idx);
      return {
        label,
        ymd,
        dayNum: Number(ymd.slice(8, 10)),
        isToday: ymd === todayStr,
        isFuture: ymd > todayStr,
        studied: activitySet.has(ymd),
      };
    });
  }, [todayStr, activitySet]);

  const studiedThisWeekCount = weekDays.filter((d) => d.studied).length;
  const streakDays = useMemo(
    () => computeStreakDays(activitySet, todayStr),
    [activitySet, todayStr],
  );

  const completedCourseCount = dogCourses.filter((c) => c.status === "COMPLETED").length;

  // 배지 정렬 (획득 우선 → 원래 순서) + 미획득 배지 진행률 산출
  const badgeCards = useMemo(() => {
    const computeProgress = (code: string): { current: number; target: number } | null => {
      if (code === "FIRST_LESSON") {
        return { current: Math.min(1, dogLessons.length), target: 1 };
      }
      if (code === "STREAK_5") {
        return { current: Math.min(5, dogLessons.length), target: 5 };
      }
      if (code === "UNIT_MASTER") {
        if (dogUnitStats.length === 0) return { current: 0, target: 1 };
        let best = dogUnitStats[0]!;
        let bestRatio = best.totalLessons > 0 ? best.completedLessons / best.totalLessons : 0;
        for (const u of dogUnitStats) {
          const r = u.totalLessons > 0 ? u.completedLessons / u.totalLessons : 0;
          if (r > bestRatio) {
            best = u;
            bestRatio = r;
          }
        }
        return {
          current: Math.min(best.totalLessons, best.completedLessons),
          target: Math.max(1, best.totalLessons),
        };
      }
      if (code === "COURSE_PUPPY_BASIC") {
        const enrolled = dogCourses.find((c) => c.courseCode === "PUPPY_BASIC_101");
        const catalog = courseCatalog.find((c) => c.courseCode === "PUPPY_BASIC_101");
        const target = enrolled?.totalLessons ?? catalog?.totalLessons ?? 3;
        return { current: Math.min(target, enrolled?.completedLessons ?? 0), target };
      }
      if (code === "COURSE_WALK_MANNER") {
        const enrolled = dogCourses.find((c) => c.courseCode === "WALK_MANNER_201");
        const catalog = courseCatalog.find((c) => c.courseCode === "WALK_MANNER_201");
        const target = enrolled?.totalLessons ?? catalog?.totalLessons ?? 1;
        return { current: Math.min(target, enrolled?.completedLessons ?? 0), target };
      }
      return null;
    };

    return [...allBadges]
      .map((badge) => {
        const earnedAt = dogEarnedMap.get(badge.id) ?? null;
        return {
          ...badge,
          earnedAt,
          progress: earnedAt ? null : computeProgress(badge.code),
        };
      })
      .sort((a, b) => {
        if (Boolean(a.earnedAt) !== Boolean(b.earnedAt)) return a.earnedAt ? -1 : 1;
        return a.id - b.id;
      });
  }, [allBadges, dogEarnedMap, dogLessons.length, dogUnitStats, dogCourses, courseCatalog]);

  const earnedCount = dogEarnedMap.size;
  const visibleLessons = showAllLessons ? dogLessons : dogLessons.slice(0, 5);
  const doneLessonCount = dogLessons.length;
  const activeBadgeDetail =
    selectedBadgeId !== null ? (badgeCards.find((b) => b.id === selectedBadgeId) ?? null) : null;

  return (
    <>
      {/* 하단 프라이머리 그린 그라데이션 + 왼쪽 밑→우측 옆 강아지 발자국 길 배경 */}
      <div
        aria-hidden="true"
        className="waggle-record-bg pointer-events-none fixed inset-x-0 bottom-0 z-0 mx-auto h-[26rem] w-full max-w-app overflow-hidden"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 390 380"
          preserveAspectRatio="xMidYMax slice"
          className="size-full text-brand"
        >
          <defs>
            <g id="waggle-record-trail-paw" fill="currentColor">
              <ellipse cx="-10" cy="-5" rx="3.5" ry="4" />
              <ellipse cx="-4" cy="-11.5" rx="3.5" ry="4.5" />
              <ellipse cx="4" cy="-11.5" rx="3.5" ry="4.5" />
              <ellipse cx="10" cy="-5" rx="3.5" ry="4" />
              <ellipse cx="0" cy="1" rx="6" ry="7" />
              <circle cx="-5" cy="5" r="5" />
              <circle cx="5" cy="5" r="5" />
            </g>
          </defs>
          {/* 왼쪽 밑에서 우측 옆으로 총총 걸어간 왼발·오른발 발자국 길 */}
          <use href="#waggle-record-trail-paw" transform="translate(36 334) rotate(56) scale(0.92)" opacity="0.16" />
          <use href="#waggle-record-trail-paw" transform="translate(96 318) rotate(58) scale(0.9)" opacity="0.15" />
          <use href="#waggle-record-trail-paw" transform="translate(142 268) rotate(52) scale(0.88)" opacity="0.14" />
          <use href="#waggle-record-trail-paw" transform="translate(204 250) rotate(55) scale(0.86)" opacity="0.13" />
          <use href="#waggle-record-trail-paw" transform="translate(254 202) rotate(54) scale(0.84)" opacity="0.11" />
          <use href="#waggle-record-trail-paw" transform="translate(316 184) rotate(58) scale(0.82)" opacity="0.09" />
          <use href="#waggle-record-trail-paw" transform="translate(362 138) rotate(60) scale(0.8)" opacity="0.07" />
        </svg>
      </div>

      <div className="waggle-stagger relative z-10 flex flex-1 flex-col space-y-5 pb-24">
      {/* 상단 반려견 프로필 스위처 (/app/daily와 100% 통일된 1줄 인라인 DDL) */}
      <section className="space-y-3">
        {dogs.length === 1 ? (
          <Link
            href="/app/my/dogs"
            className="waggle-squircle-box flex items-center gap-3 bg-surface-subtle px-3.5 py-2.5 transition-colors hover:bg-ink/[0.05] active:scale-[0.99]"
          >
            <span className="waggle-squircle inline-flex shrink-0 bg-surface p-0.5 dark:bg-white/15">
              <DogAvatar
                src={selectedDog.profileImage}
                name={selectedDog.name}
                size="md"
                shape="squircle"
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-extrabold tracking-tight text-ink">
                  {selectedDog.name}
                </p>
                <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold text-brand-strong">
                  {formatGradeLabel(selectedDog.grade, sortedTiers)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm text-ink-muted">
                {selectedDog.breedName ?? "우리 반려견"}의 교육 기록
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
              className="waggle-squircle-box flex w-full items-center gap-3 bg-surface-subtle px-3.5 py-2.5 text-left transition-colors hover:bg-ink/[0.05] active:scale-[0.99]"
            >
              <span className="waggle-squircle inline-flex shrink-0 bg-surface p-0.5 dark:bg-white/15">
                <DogAvatar
                  src={selectedDog.profileImage}
                  name={selectedDog.name}
                  size="md"
                  shape="squircle"
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-base font-extrabold tracking-tight text-ink">
                    {selectedDog.name}
                  </p>
                  <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold text-brand-strong">
                    {formatGradeLabel(selectedDog.grade, sortedTiers)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-ink-muted">
                  {selectedDog.breedName ?? "우리 반려견"}의 교육 기록
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
                className="waggle-squircle-panel animate-fade-in absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden border border-border-subtle bg-surface shadow-lg"
              >
                <div className="max-h-64 overflow-y-auto py-1">
                  {dogs.map((d) => {
                    const isActive = d.id === selectedDogId;
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
                            <span className="truncate text-sm font-bold text-ink">{d.name}</span>
                            <span className="text-xs font-semibold text-brand-strong">
                              {formatGradeLabel(d.grade, sortedTiers)}
                            </span>
                          </div>
                          {d.breedName && (
                            <p className="truncate text-xs text-ink-muted">{d.breedName}</p>
                          )}
                        </div>
                        {isActive && (
                          <Check className="size-4 shrink-0 text-brand-strong" strokeWidth={2.4} />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-border-subtle">
                  <Link
                    href="/app/my/dogs"
                    onClick={() => setDogDropdownOpen(false)}
                    className="flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
                  >
                    <span className="flex items-center gap-1.5">
                      <Settings className="size-3.5" strokeWidth={2} />내 반려견 관리
                    </span>
                    <ChevronRight className="size-3.5" strokeWidth={2} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2탭 전환: 성장 · 기록 | 학년 · 배지 */}
        <AppSegmented<RecordMainTab>
          ariaLabel="교육 기록 탭"
          asTabs
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "growth", label: "성장 · 기록" },
            { value: "badges", label: "학년 · 배지", count: earnedCount },
          ]}
        />
      </section>

      {/* ========== TAB 1: 성장 · 기록 (레인보우 주간 패스 + 코스 진도 + 복습 리스트) ========== */}
      {activeTab === "growth" && (
        <div className="space-y-6">
          {/* 1. 이번 주 학습 리듬 + 1줄 요약 통계 (레인보우 멀티 그라데이션 카드) */}
          <section className="waggle-pass-1 space-y-4 rounded-3xl p-4.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold tracking-tight text-ink">이번 주</h2>
              {streakDays > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-extrabold tabular-nums text-ink">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/badges/streak-5.webp"
                    alt="연속 학습"
                    width={18}
                    height={18}
                    className="size-4.5 object-contain"
                  />
                  {streakDays}일 연속
                </span>
              ) : (
                <span className="text-xs font-semibold tabular-nums text-ink/75">
                  {studiedThisWeekCount}일 학습
                </span>
              )}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day) => (
                <div key={day.ymd} className="flex flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      "text-sm font-normal",
                      day.isToday ? "text-brand-strong" : "text-ink",
                    )}
                  >
                    {day.label}
                  </span>
                  <div
                    aria-label={`${day.ymd} ${day.studied ? "학습 완료" : "미학습"}`}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full text-xs font-bold tabular-nums transition-colors",
                      day.studied
                        ? "bg-brand text-white shadow-xs"
                        : day.isToday
                          ? "bg-surface text-brand-strong ring-1.5 ring-brand"
                          : day.isFuture
                            ? "bg-surface/70 text-ink/55"
                            : "bg-surface/85 text-ink/75",
                    )}
                  >
                    {day.studied ? (
                      <PawIcon className="size-5" />
                    ) : (
                      <span>{day.dayNum}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1 text-xs tabular-nums">
              <div className="flex items-center gap-3 font-medium text-ink/80">
                <span>
                  완료 <strong className="font-extrabold text-ink">{doneLessonCount}</strong>
                </span>
                <span>
                  완주 <strong className="font-extrabold text-ink">{completedCourseCount}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("badges")}
                className="inline-flex items-center gap-0.5 font-semibold text-ink/85 transition-opacity active:opacity-70"
              >
                배지 <strong className="font-extrabold text-brand-strong">{earnedCount}/{allBadges.length}</strong>
                <ChevronRight className="size-3.5 text-ink/75" strokeWidth={2.2} />
              </button>
            </div>
          </section>

          {/* 2. 최근 완료한 강의 (최신순 · 퀴즈 점수 · 복습 바로가기) */}
          <section className="space-y-2.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold tracking-tight text-ink">완료한 강의</h2>
              {doneLessonCount > 0 && (
                <span className="text-xs font-semibold tabular-nums text-ink-muted">
                  {doneLessonCount}강
                </span>
              )}
            </div>

            {doneLessonCount === 0 ? (
              <EmptyStateCard
                mode="section"
                icon={<CheckCircle2 className="size-5" strokeWidth={1.8} />}
                title="아직 완료한 강의가 없어요"
                description="첫 강의를 완료하면 복습 기록이 여기에 쌓여요."
                ctaLabel="강좌 둘러보기"
                ctaHref="/app?tab=explore"
              />
            ) : (
              <>
                <ul className="divide-y divide-border-subtle border-y border-border-subtle">
                  {visibleLessons.map((item) => (
                    <li key={item.id}>
                      <AppLink
                        href={`/app/lesson/${item.lessonId}`}
                        className="flex items-center justify-between gap-3 py-3.5 transition-opacity active:opacity-70"
                      >
                        <div className="flex min-w-0 items-start gap-2.5">
                          <CheckCircle2
                            className="mt-0.5 size-4.5 shrink-0 text-brand"
                            strokeWidth={2.2}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                              {item.lessonTitle}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ink-muted">
                              <span className="truncate">{item.courseTitle}</span>
                              {item.completedVia === "LEVEL_TEST" ? (
                                <span className="rounded bg-brand-soft px-1.5 py-0.5 font-semibold text-brand-strong">
                                  레벨테스트
                                </span>
                              ) : item.quizScore !== null && item.quizTotal !== null ? (
                                <span className="font-semibold tabular-nums text-brand-strong">
                                  퀴즈 {item.quizScore}/{item.quizTotal}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-xs tabular-nums text-ink-muted">
                            {formatDateDot(item.completedAt, "")}
                          </span>
                          <ChevronRight className="size-4 text-ink-muted" strokeWidth={1.8} />
                        </div>
                      </AppLink>
                    </li>
                  ))}
                </ul>

                {doneLessonCount > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllLessons((prev) => !prev)}
                    className="flex w-full items-center justify-center rounded-2xl bg-surface-subtle py-2.5 text-xs font-semibold text-ink-muted transition-colors hover:text-ink active:scale-[0.99]"
                  >
                    {showAllLessons ? "접기" : `전체 보기 (${doneLessonCount}강)`}
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {/* ========== TAB 2: 학년 · 배지 (상단 그라데이션 스쿨 패스 → 하단 3열 무박스 3D 배지 진열대) ========== */}
      {activeTab === "badges" && (
        <div className="space-y-7">
          {/* 1. 상단 내 학년 (소프트 파스텔 그라데이션 스쿨 패스 + 미니 발바닥 여정 인디케이터) */}
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold tracking-tight text-ink">내 학년</h2>
              <span className="text-xs font-semibold tabular-nums text-ink-muted">
                {formatGradeLabel(selectedDog.grade, sortedTiers)}
              </span>
            </div>

            {/* Peek 가로 스와이프 그라데이션 스쿨 패스 */}
            <div
              ref={gradeTrackRef}
              onScroll={handleGradeTrackScroll}
              onPointerDown={handleGradePointerDown}
              onPointerMove={handleGradePointerMove}
              onPointerUp={handleGradePointerEnd}
              onPointerCancel={handleGradePointerEnd}
              className="swipe-x no-scrollbar -mx-4 flex cursor-grab snap-x snap-proximity gap-2.5 overflow-x-auto px-4 pb-1 select-none active:cursor-grabbing"
            >
              {sortedTiers.map((tier, idx) => {
                const isCurrent = tier.grade === selectedDog.grade;
                const isDone = tier.grade < selectedDog.grade;
                const nextTier = sortedTiers[idx + 1] ?? null;
                const cardTheme = getGradeCardTheme(tier.grade);

                const progressTarget = isCurrent
                  ? (nextTier?.minLessons ?? null)
                  : isDone
                    ? null
                    : tier.minLessons;
                const progressPct =
                  progressTarget && progressTarget > 0
                    ? Math.min(100, Math.round((doneLessonCount / progressTarget) * 100))
                    : 100;
                const remaining =
                  progressTarget !== null ? Math.max(0, progressTarget - doneLessonCount) : 0;

                return (
                  <div
                    key={tier.grade}
                    className={cn(
                      "flex w-[74%] shrink-0 snap-start scroll-ml-4 flex-col justify-between rounded-3xl p-4.5",
                      isCurrent || isDone
                        ? cardTheme.gradient
                        : "waggle-pass-locked",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/90 py-0.5 pl-0.5 pr-2.5 text-xs font-bold text-ink shadow-xs">
                          <DogAvatar
                            src={selectedDog.profileImage}
                            name={selectedDog.name}
                            size="xs"
                          />
                          {selectedDog.name}
                        </span>
                      ) : isDone ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-xs font-bold",
                            cardTheme.accentText,
                          )}
                        >
                          <Check className="size-3.5" strokeWidth={2.6} />
                          달성 완료
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted">
                          <Lock className="size-3" strokeWidth={2} />
                          누적 {tier.minLessons}강
                        </span>
                      )}

                      <GraduationCap
                        className={cn(
                          "size-5 shrink-0",
                          isCurrent || isDone ? cardTheme.accentText : "text-ink-muted/60",
                        )}
                        strokeWidth={2}
                      />
                    </div>

                    <h3 className="mt-3 text-base font-extrabold tracking-tight text-ink">
                      {tier.title}
                    </h3>

                    <div className="mt-3.5 space-y-1.5">
                      {isCurrent && nextTier ? (
                        <>
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="font-semibold text-ink">
                              {nextTier.title}까지{" "}
                              <strong className={cn("font-bold tabular-nums", cardTheme.accentText)}>
                                {remaining}강
                              </strong>
                            </span>
                            <span className="font-bold tabular-nums text-ink-muted">
                              {Math.min(doneLessonCount, nextTier.minLessons)}/{nextTier.minLessons}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-surface/90">
                            <div
                              className={cn(
                                "h-full rounded-full transition-[width] duration-300",
                                cardTheme.barFill,
                              )}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </>
                      ) : isCurrent && !nextTier ? (
                        <p className={cn("text-xs font-bold tabular-nums", cardTheme.accentText)}>
                          최고 학년 달성 · 누적 {doneLessonCount}강
                        </p>
                      ) : isDone ? (
                        <p className="text-xs font-medium tabular-nums text-ink-muted">
                          누적 {tier.minLessons}강 기준 달성
                        </p>
                      ) : (
                        <>
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="text-ink-muted">승급까지 {remaining}강</span>
                            <span className="font-semibold tabular-nums text-ink-muted">
                              {Math.min(doneLessonCount, tier.minLessons)}/{tier.minLessons}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                            <div
                              className={cn(
                                "h-full rounded-full opacity-70 transition-[width] duration-300",
                                cardTheme.barFill,
                              )}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 카드 하단 아기자기한 발바닥 · 모핑 도트 위치 인디케이터 (숫자 없음) */}
            <div className="flex items-center justify-center gap-2 pt-0.5">
              {sortedTiers.map((tier, idx) => {
                const isCurrent = tier.grade === selectedDog.grade;
                const isDone = tier.grade < selectedDog.grade;
                const isViewing = idx === viewingGradeIdx;
                const dotTheme = getGradeCardTheme(tier.grade);

                return (
                  <button
                    key={tier.grade}
                    type="button"
                    onClick={() => scrollToGradeIndex(idx)}
                    aria-label={`${tier.title} 보기`}
                    aria-current={isCurrent ? "step" : undefined}
                    className="flex h-5 items-center justify-center px-0.5 transition-transform active:scale-90"
                  >
                    {isViewing ? (
                      <span
                        className={cn(
                          "h-2 w-5 rounded-full transition-all duration-200",
                          isCurrent || isDone ? dotTheme.dotActive : "bg-ink/45",
                        )}
                      />
                    ) : isCurrent || isDone ? (
                      <PawIcon className="size-3.5 text-brand transition-opacity" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-ink/15 transition-colors" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. 하단 배지 도감 (3열 순백 무박스 3D 트로피 진열대 · 탭 시 상세 팝업) */}
          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold tracking-tight text-ink">배지 도감</h2>
              <span className="text-xs font-bold tabular-nums text-brand-strong">
                {earnedCount} / {allBadges.length}
              </span>
            </div>

            {badgeCards.length === 0 ? (
              <EmptyStateCard
                mode="section"
                icon={<Award className="size-5" strokeWidth={1.8} />}
                title="등록된 배지가 없어요"
                description="교육을 진행하면 새로운 배지를 모을 수 있어요."
              />
            ) : (
              <div className="grid grid-cols-3 gap-x-2 gap-y-5">
                {badgeCards.map((badge) => {
                  const isEarned = Boolean(badge.earnedAt);
                  const theme = getBadgeTheme(badge.code);
                  const prog = badge.progress;
                  const progPct =
                    prog && prog.target > 0
                      ? Math.min(100, Math.round((prog.current / prog.target) * 100))
                      : 0;

                  return (
                    <button
                      key={badge.id}
                      type="button"
                      onClick={() => setSelectedBadgeId(badge.id)}
                      className="group flex flex-col items-center text-center transition-transform active:scale-[0.94]"
                    >
                      <div className="relative flex size-[4.5rem] items-center justify-center">
                        {theme.imageSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={theme.imageSrc}
                            alt={badge.name}
                            width={72}
                            height={72}
                            className={cn(
                              "relative z-10 size-[4.25rem] object-contain transition-transform duration-200 group-hover:scale-105",
                              isEarned
                                ? "drop-shadow-xs"
                                : "opacity-35 grayscale-[0.75]",
                            )}
                          />
                        ) : (
                          renderBadgeIcon(
                            badge.code,
                            badge.iconName,
                            cn(theme.iconColor, !isEarned && "opacity-45 grayscale"),
                          )
                        )}
                        {isEarned ? (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute -bottom-0.5 h-2 w-10 rounded-full bg-ink/[0.06] blur-[2px]"
                          />
                        ) : (
                          <span className="absolute bottom-0.5 right-0.5 z-20 flex size-5 items-center justify-center rounded-full bg-surface shadow-xs ring-1 ring-border-subtle">
                            <Lock className="size-2.5 text-ink-muted" strokeWidth={2.2} />
                          </span>
                        )}
                      </div>

                      <p
                        className={cn(
                          "mt-2 line-clamp-1 text-xs font-bold tracking-tight",
                          isEarned ? "text-ink" : "text-ink-muted",
                        )}
                      >
                        {badge.name}
                      </p>

                      {isEarned ? (
                        <span className="mt-0.5 text-xs font-medium tabular-nums text-brand-strong">
                          {formatDateDot(badge.earnedAt).slice(5)} 획득
                        </span>
                      ) : prog ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          <div className="h-1 w-9 overflow-hidden rounded-full bg-surface-subtle">
                            <div
                              className={cn("h-full rounded-full", theme.barFill)}
                              style={{ width: `${progPct}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium tabular-nums text-ink-muted">
                            {prog.current}/{prog.target}
                          </span>
                        </div>
                      ) : (
                        <span className="mt-0.5 text-xs text-ink-muted">미획득</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 배지 수집 상세 팝업 (AppCenterModal) */}
      <AppCenterModal
        open={Boolean(activeBadgeDetail)}
        onClose={() => setSelectedBadgeId(null)}
        modalId="record-badge-detail"
        hideHeader
        maxWidthClassName="max-w-[20rem]"
      >
        {activeBadgeDetail && (() => {
          const isEarned = Boolean(activeBadgeDetail.earnedAt);
          const theme = getBadgeTheme(activeBadgeDetail.code);
          const prog = activeBadgeDetail.progress;
          const progPct =
            prog && prog.target > 0
              ? Math.min(100, Math.round((prog.current / prog.target) * 100))
              : 0;

          return (
            <div className="relative flex flex-col items-center px-6 pb-6 pt-8 text-center">
              <button
                type="button"
                onClick={() => setSelectedBadgeId(null)}
                aria-label="배지 상세 닫기"
                className="absolute right-3.5 top-3.5 flex size-9 items-center justify-center rounded-full bg-ink/[0.06] text-ink/80 transition-colors hover:bg-ink/[0.11] active:scale-[0.94]"
              >
                <X className="size-5" strokeWidth={1.6} />
              </button>

              <div
                className={cn(
                  "flex size-28 items-center justify-center rounded-full",
                  isEarned ? theme.auraBg : "bg-surface-subtle",
                )}
              >
                {theme.imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={theme.imageSrc}
                    alt={activeBadgeDetail.name}
                    width={96}
                    height={96}
                    className={cn(
                      "size-24 object-contain",
                      isEarned ? "drop-shadow-sm" : "opacity-45 grayscale-[0.7]",
                    )}
                  />
                ) : (
                  renderBadgeIcon(
                    activeBadgeDetail.code,
                    activeBadgeDetail.iconName,
                    cn("size-12", theme.iconColor, !isEarned && "opacity-50 grayscale"),
                  )
                )}
              </div>

              <h3 className="mt-4 text-lg font-extrabold tracking-tight text-ink">
                {activeBadgeDetail.name}
              </h3>
              {activeBadgeDetail.description && (
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted break-keep">
                  {activeBadgeDetail.description}
                </p>
              )}

              <div className="mt-4 w-full">
                {isEarned ? (
                  <p className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-3.5 py-1.5 text-xs font-bold tabular-nums text-brand-strong">
                    <Check className="size-3.5" strokeWidth={2.5} />
                    {formatDateDot(activeBadgeDetail.earnedAt)} 획득
                  </p>
                ) : prog ? (
                  <div className="space-y-1.5 rounded-2xl bg-surface-subtle px-4 py-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink-muted">달성 진행률</span>
                      <span className="font-bold tabular-nums text-ink">
                        {prog.current} / {prog.target}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface">
                      <div
                        className={cn("h-full rounded-full", theme.barFill)}
                        style={{ width: `${progPct}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-medium text-ink-muted">아직 획득하지 않은 배지예요</p>
                )}
              </div>

              <AppButton
                type="button"
                variant="primary"
                className="mt-5 w-full"
                onClick={() => setSelectedBadgeId(null)}
              >
                확인
              </AppButton>
            </div>
          );
        })()}
      </AppCenterModal>
      </div>
    </>
  );
}
