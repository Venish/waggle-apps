"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Lock,
  MessageSquareText,
  Minus,
  Search,
  Settings,
  Target,
  Ticket,
  Unlock,
  X,
} from "lucide-react";
import { cn, PawIcon } from "@repo/ui";
import {
  calcProgressPercent,
  formatDPlus,
  formatGradeLabel,
  type GradeTierPolicy,
} from "@repo/types";
import { updateCurrentNavHref } from "@/00_lib/mobileNavHistory";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { useHorizontalDragScroll } from "@/02_hooks/useHorizontalDragScroll";
import { useSubmitLock } from "@/02_hooks/useSubmitLock";
import {
  enrollCourseAction,
  unenrollCourseAction,
} from "@/03_actions/web/onboardingEducationActions";
import { DogAvatar, EmptyStateCard } from "@/components/web/WebUiKit";
import { AppLink, AppLinkButton, AppSegmented } from "@/components/web/ui";

export type EducationMainTab = "my" | "explore";

export interface EduDogOption {
  id: number;
  name: string;
  isPrimary: boolean;
  grade: number;
  birthDate: string; // YYYY-MM-DD
  profileImage: string | null;
  breedName: string | null;
}

export interface EduLessonStepView {
  lessonId: number;
  lessonTitle: string;
  unitTitle: string;
  status: "completed" | "current" | "available" | "locked";
}

export interface EduEnrollmentView {
  dogId: number;
  courseId: number;
  courseTitle: string;
  courseLevel: number;
  status: "IN_PROGRESS" | "COMPLETED";
  progressPct: number;
  doneLessons: number;
  totalLessons: number;
  startedAt: string; // ISO
  lastActivityAt: string | null; // ISO
  steps: EduLessonStepView[];
}

export interface EduCatalogCourseView {
  id: number;
  code: string;
  title: string;
  description: string | null;
  level: number;
  isPremium: boolean;
  isUnlocked: boolean;
  availableTicketId: number | null;
  pointPrice: number | null;
  lessonCount: number;
  lessonTitles: string[];
}

type ExploreFilter = "ALL" | "FREE" | "PREMIUM" | "ENROLLED" | `LV_${number}`;

export function EducationHomeClient({
  dogs,
  initialDogId,
  initialTab,
  initialExploreFilter = "ALL",
  dailyGoal,
  completedTodayByDog,
  gradeTiers,
  enrollments,
  catalogCourses,
}: {
  dogs: EduDogOption[];
  initialDogId: number;
  initialTab: EducationMainTab;
  initialExploreFilter?: "ALL" | "FREE" | "PREMIUM";
  dailyGoal: number;
  completedTodayByDog: Record<number, number>;
  gradeTiers: GradeTierPolicy[];
  enrollments: EduEnrollmentView[];
  catalogCourses: EduCatalogCourseView[];
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const enrollLock = useSubmitLock();
  const unenrollLock = useSubmitLock();
  const [enrollingCourseId, setEnrollingCourseId] = useState<number | null>(null);
  const [selectedDogId, setSelectedDogId] = useState(initialDogId);
  const [activeTab, setActiveTab] = useState<EducationMainTab>(initialTab);
  const [dogDropdownOpen, setDogDropdownOpen] = useState(false);
  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [exploreFilter, setExploreFilter] = useState<ExploreFilter>(initialExploreFilter);
  const dogDropdownRef = useRef<HTMLDivElement>(null);
  const { ref: filterTrackRef, dragProps: filterDragProps } = useHorizontalDragScroll<HTMLDivElement>();

  // 화면 바깥으로 잘린 필터 칩을 선택했을 때만 트랙을 최소한으로 스크롤 (이미 보이는 칩은 고정)
  useEffect(() => {
    if (activeTab !== "explore") return;
    const track = filterTrackRef.current;
    if (!track) return;
    const activeEl = track.querySelector<HTMLElement>('[data-active="true"]');
    if (!activeEl) return;

    const pad = 16;
    const elLeft = activeEl.offsetLeft;
    const elRight = elLeft + activeEl.offsetWidth;
    const viewLeft = track.scrollLeft;
    const viewRight = viewLeft + track.clientWidth;

    if (elLeft < viewLeft + pad) {
      track.scrollTo({ left: Math.max(0, elLeft - pad), behavior: "smooth" });
    } else if (elRight > viewRight - pad) {
      track.scrollTo({ left: elRight - track.clientWidth + pad, behavior: "smooth" });
    }
  }, [activeTab, exploreFilter, filterTrackRef]);

  const selectedDog = dogs.find((d) => d.id === selectedDogId) ?? dogs[0]!;
  const completedToday = completedTodayByDog[selectedDogId] ?? 0;

  // 뒤로가기 복귀 시 현재 탭·반려견 선택 상태를 정확히 복원하도록 네비게이션 스택 href 동기화
  useEffect(() => {
    const qs = new URLSearchParams();
    if (activeTab === "explore") qs.set("tab", "explore");
    if (selectedDogId !== initialDogId) qs.set("dogId", String(selectedDogId));
    const suffix = qs.toString();
    updateCurrentNavHref("/app", suffix ? `/app?${suffix}` : "/app");
  }, [activeTab, selectedDogId, initialDogId]);

  const dogEnrollments = useMemo(
    () =>
      enrollments
        .filter((e) => e.dogId === selectedDogId)
        .sort((a, b) => {
          // 1) 진행 중 > 완주
          if (a.status !== b.status) return a.status === "IN_PROGRESS" ? -1 : 1;
          // 2) 실제 학습 이력이 있는 강좌 우선 (최근 학습순)
          const aStudied = a.doneLessons > 0 || a.lastActivityAt !== null;
          const bStudied = b.doneLessons > 0 || b.lastActivityAt !== null;
          if (aStudied !== bStudied) return aStudied ? -1 : 1;
          if (a.lastActivityAt && b.lastActivityAt && a.lastActivityAt !== b.lastActivityAt) {
            return b.lastActivityAt.localeCompare(a.lastActivityAt);
          }
          // 3) 최근 신청순 → 레벨순
          if (a.startedAt !== b.startedAt) return b.startedAt.localeCompare(a.startedAt);
          return a.courseLevel - b.courseLevel;
        }),
    [enrollments, selectedDogId],
  );

  // 반려견 전환 시 기본 첫 강좌 펼침으로 리셋
  useEffect(() => {
    setExpandedCourseId(null);
  }, [selectedDogId]);

  const resolvedExpandedCourseId =
    expandedCourseId === -1
      ? null
      : expandedCourseId !== null && dogEnrollments.some((e) => e.courseId === expandedCourseId)
        ? expandedCourseId
        : (dogEnrollments[0]?.courseId ?? null);

  const handleEnrollCourse = async (course: EduCatalogCourseView) => {
    if (enrollLock.pending) return;
    setEnrollingCourseId(course.id);
    try {
      await enrollLock.run(async () => {
        const res = await enrollCourseAction(course.id, selectedDogId);
        if (!res.ok) {
          openAlert({
            title: "강좌 담기 실패",
            description: res.error.message,
            tone: "destructive",
          });
          return;
        }
        router.refresh();
        openAlert({
          title: "내 강좌에 담았어요",
          description: `「${course.title}」이(가) ${selectedDog.name}의 내 강좌 목록에 추가되었습니다.`,
          confirmLabel: "내 강좌 보기",
          cancelLabel: "계속 둘러보기",
          onConfirm: () => {
            setActiveTab("my");
            setExpandedCourseId(course.id);
          },
        });
      });
    } finally {
      setEnrollingCourseId(null);
    }
  };

  const handleUnenrollCourse = (targetCourse: EduEnrollmentView) => {
    if (unenrollLock.pending) return;
    openAlert({
      title: "내 강좌 목록에서 뺄까요?",
      description: `「${targetCourse.courseTitle}」을 목록에서 제외합니다. 완료한 강의 기록과 포인트는 유지되며, 전체 강좌에서 언제든 다시 시작할 수 있어요.`,
      tone: "destructive",
      confirmLabel: "목록에서 빼기",
      cancelLabel: "취소",
      onConfirm: async () => {
        await unenrollLock.run(async () => {
          const res = await unenrollCourseAction({
            courseId: targetCourse.courseId,
            dogId: selectedDogId,
          });
          if (!res.ok) {
            openAlert({
              title: "목록 제외 실패",
              description: res.error.message,
              tone: "destructive",
            });
            return;
          }
          setExpandedCourseId(null);
          router.refresh();
        });
      },
    });
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

  const enrollmentByCourseId = useMemo(
    () => new Map(dogEnrollments.map((e) => [e.courseId, e])),
    [dogEnrollments],
  );

  // 미수강 반려견용 추천 첫 코스 (무료 Lv.1 우선)
  const starterCourse = useMemo(
    () =>
      catalogCourses.find((c) => !c.isPremium && c.level === 1) ??
      catalogCourses.find((c) => !c.isPremium) ??
      catalogCourses[0] ??
      null,
    [catalogCourses],
  );

  // 교육 찾기 레벨 목록
  const availableLevels = useMemo(
    () => Array.from(new Set(catalogCourses.map((c) => c.level))).sort((a, b) => a - b),
    [catalogCourses],
  );

  // 교육 찾기 검색 & 필터 결과 (200개 영상 대비 코스명 + 설명 + 내부 레슨 제목 통합 검색)
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalogCourses
      .map((course) => {
        const matchedLesson = q
          ? (course.lessonTitles.find((t) => t.toLowerCase().includes(q)) ?? null)
          : null;
        return { course, matchedLesson };
      })
      .filter(({ course, matchedLesson }) => {
        if (exploreFilter === "FREE" && course.isPremium) return false;
        if (exploreFilter === "PREMIUM" && !course.isPremium) return false;
        if (exploreFilter === "ENROLLED" && !enrollmentByCourseId.has(course.id)) return false;
        if (exploreFilter.startsWith("LV_")) {
          const lv = Number(exploreFilter.slice(3));
          if (course.level !== lv) return false;
        }
        if (q) {
          const inTitle = course.title.toLowerCase().includes(q);
          const inDesc = (course.description ?? "").toLowerCase().includes(q);
          if (!inTitle && !inDesc && !matchedLesson) return false;
        }
        return true;
      });
  }, [catalogCourses, searchQuery, exploreFilter, enrollmentByCourseId]);

  const filterChips: Array<{ key: ExploreFilter; label: string }> = [
    { key: "ALL", label: "전체" },
    ...(dogEnrollments.length > 0 ? [{ key: "ENROLLED" as const, label: "수강 중" }] : []),
    { key: "FREE", label: "무료" },
    { key: "PREMIUM", label: "프리미엄" },
    ...availableLevels.map((lv) => ({ key: `LV_${lv}` as ExploreFilter, label: `Lv.${lv}` })),
  ];

  return (
    <div className="waggle-stagger flex flex-1 flex-col space-y-5 pb-24">
      {/* 상단 반려견 프로필 스위처 (/app/record · /app/daily 100% 패밀리 룩) */}
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
                  <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold text-brand-strong">
                    {formatGradeLabel(selectedDog.grade, gradeTiers)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm tabular-nums text-ink-muted">
                  {selectedDog.breedName ?? "우리 반려견"} · {formatDPlus(selectedDog.birthDate)}
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
                    <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold text-brand-strong">
                      {formatGradeLabel(selectedDog.grade, gradeTiers)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm tabular-nums text-ink-muted">
                    {selectedDog.breedName ?? "우리 반려견"} · {formatDPlus(selectedDog.birthDate)}
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
                                {formatGradeLabel(d.grade, gradeTiers)}
                              </span>
                            </div>
                            <p className="truncate text-xs tabular-nums text-ink-muted">
                              {d.breedName ?? "반려견"} · {formatDPlus(d.birthDate)}
                            </p>
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

          {/* 2탭 전환: 내 강좌 | 전체 강좌 */}
          <AppSegmented<EducationMainTab>
            ariaLabel="교육 메인 탭"
            asTabs
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: "my", label: "내 강좌" },
              { value: "explore", label: "전체 강좌", count: catalogCourses.length },
            ]}
          />
        </section>

        {/* ========== TAB 1: 내 강좌 (아코디언 세로 강좌 카드 — 한눈에 전체 + 1탭 세부 강의) ========== */}
        {activeTab === "my" && (
          <div className="space-y-6">
            {dogEnrollments.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-1.5">
                    <h1 className="text-sm font-bold tracking-tight text-ink">수강 중인 강좌</h1>
                    <span className="text-xs font-semibold tabular-nums text-ink-muted">
                      {dogEnrollments.length}
                    </span>
                  </div>
                  <AppLink
                    href="/app/my/goal"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-ink transition-opacity active:opacity-70"
                  >
                    <Target className="size-3.5 text-brand" strokeWidth={2.2} />
                    오늘 {completedToday}/{dailyGoal}
                  </AppLink>
                </div>

                <ul className="space-y-3">
                  {dogEnrollments.map((course) => {
                    const isExpanded = resolvedExpandedCourseId === course.courseId;
                    const isDoneCourse = course.status === "COMPLETED";
                    const isUnstarted = course.doneLessons === 0 && !course.lastActivityAt;
                    const courseNext =
                      course.steps.find((s) => s.status === "current") ??
                      course.steps[course.steps.length - 1] ??
                      null;

                    // 5강 이상인 강좌는 현재 진행 강의를 중심으로 최대 4강만 노출 + 전체 보기 연결
                    const visibleSteps = (() => {
                      if (course.steps.length <= 4) return course.steps;
                      const curIdx = course.steps.findIndex((s) => s.status === "current");
                      if (curIdx <= 1) return course.steps.slice(0, 4);
                      const start = Math.min(curIdx - 1, course.steps.length - 4);
                      return course.steps.slice(start, start + 4);
                    })();

                    return (
                      <li
                        key={course.courseId}
                        className={cn(
                          "overflow-hidden rounded-2xl transition-[background-color,box-shadow,border-color] duration-300",
                          isExpanded
                            ? "border border-brand bg-gradient-to-b from-brand-soft/80 via-brand-soft/25 to-surface to-80% shadow-md shadow-brand/10"
                            : "border border-transparent bg-surface-subtle",
                        )}
                      >
                        {/* 강좌 요약 헤더 (펼침 시 카드 전체 0%→80% 민트 그라데이션 · 접힘 시 차분한 쿨그레이) */}
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpandedCourseId((prev) => {
                              const currentOpen =
                                prev === -1
                                  ? null
                                  : prev !== null &&
                                      dogEnrollments.some((e) => e.courseId === prev)
                                    ? prev
                                    : (dogEnrollments[0]?.courseId ?? null);
                              return currentOpen === course.courseId ? -1 : course.courseId;
                            })
                          }
                          className={cn(
                            "block w-full p-4 text-left transition-colors duration-300",
                            !isExpanded && "hover:bg-ink/[0.04] active:bg-ink/[0.06]",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-bold tabular-nums text-ink">
                                  Lv.{course.courseLevel}
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 font-semibold",
                                    isUnstarted ? "text-ink-muted" : "text-emerald-700",
                                  )}
                                >
                                  <span
                                    aria-hidden="true"
                                    className={cn(
                                      "size-1.5 rounded-full",
                                      isUnstarted ? "bg-ink-muted/40" : "bg-brand",
                                    )}
                                  />
                                  {isDoneCourse
                                    ? "강좌 완주"
                                    : isUnstarted
                                      ? "시작 전"
                                      : "수강 중"}
                                </span>
                              </div>
                              <p className="mt-1 truncate text-base font-extrabold tracking-tight text-ink">
                                {course.courseTitle}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                              <span className="text-sm font-extrabold tabular-nums text-ink">
                                {course.progressPct}%
                              </span>
                              <ChevronDown
                                className={cn(
                                  "size-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                                  isExpanded ? "rotate-180 text-ink" : "text-ink-muted",
                                )}
                                strokeWidth={2}
                              />
                            </div>
                          </div>

                          <div className="mt-3 space-y-1.5">
                            <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                              <div
                                className="waggle-progress-flow h-full rounded-full transition-[width] duration-300"
                                style={{ width: `${course.progressPct}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs tabular-nums text-ink">
                              <span>
                                {course.doneLessons} / {course.totalLessons} 강의 완료
                              </span>
                              {!isExpanded && courseNext && !isDoneCourse && (
                                <span className="max-w-44 truncate font-medium text-ink">
                                  다음 · {courseNext.lessonTitle}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>

                        {/* 펼쳐진 세부 강의 목차 + 바로 수강 CTA (부드러운 Grid 높이·투명도 트랜지션) */}
                        <div
                          aria-hidden={!isExpanded}
                          inert={isExpanded ? undefined : true}
                          className={cn(
                            "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                            isExpanded
                              ? "grid-rows-[1fr] opacity-100"
                              : "pointer-events-none grid-rows-[0fr] opacity-0",
                          )}
                        >
                          <div className="overflow-hidden">
                            <div className="px-4 pb-4 pt-1">
                              <div className="mb-1.5 flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-ink">강의 목차</span>
                                <button
                                  type="button"
                                  disabled={unenrollLock.pending}
                                  onClick={() => handleUnenrollCourse(course)}
                                  aria-label={`${course.courseTitle} 목록에서 빼기`}
                                  title="목록에서 빼기"
                                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 active:scale-95 disabled:opacity-50"
                                >
                                  <Minus className="size-4" strokeWidth={2.4} />
                                </button>
                              </div>

                              <ul className="divide-y divide-border-subtle">
                                {visibleSteps.map((step, stepIdx) => {
                                  const isDone = step.status === "completed";
                                  const isCurrent = step.status === "current";
                                  const isLocked = step.status === "locked";

                                  const inner = (
                                    <div className="flex items-center justify-between gap-3 py-3">
                                      <div className="flex min-w-0 items-center gap-2.5">
                                        <span
                                          className={cn(
                                            "flex size-6.5 shrink-0 items-center justify-center rounded-full",
                                            isDone
                                              ? "bg-brand text-white"
                                              : isCurrent
                                                ? "bg-brand-soft text-brand-strong"
                                                : "bg-surface-subtle text-ink-muted",
                                          )}
                                        >
                                          {isDone ? (
                                            <PawIcon className="size-3.5" />
                                          ) : isLocked ? (
                                            <Lock className="size-3" strokeWidth={2} />
                                          ) : (
                                            <span
                                              className={cn(
                                                "text-xs tabular-nums",
                                                isCurrent ? "font-extrabold" : "font-bold",
                                              )}
                                            >
                                              {stepIdx + 1}
                                            </span>
                                          )}
                                        </span>

                                        <p
                                          className={cn(
                                            "min-w-0 truncate text-sm",
                                            isCurrent
                                              ? "font-bold text-ink"
                                              : isDone
                                                ? "font-semibold text-ink"
                                                : isLocked
                                                  ? "font-medium text-ink-muted"
                                                  : "font-semibold text-ink",
                                          )}
                                        >
                                          {step.lessonTitle}
                                        </p>
                                      </div>

                                      <div className="flex shrink-0 items-center gap-1">
                                        {isCurrent && (
                                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                                            <span
                                              aria-hidden="true"
                                              className="size-1.5 rounded-full bg-brand"
                                            />
                                            다음
                                          </span>
                                        )}
                                        {isDone && (
                                          <span className="text-xs font-semibold text-ink">
                                            완료
                                          </span>
                                        )}
                                        {!isLocked && (
                                          <ChevronRight
                                            className="size-4 text-ink"
                                            strokeWidth={1.8}
                                          />
                                        )}
                                      </div>
                                    </div>
                                  );

                                  return (
                                    <li key={step.lessonId}>
                                      {isLocked ? (
                                        <div aria-disabled="true" className="opacity-60">
                                          {inner}
                                        </div>
                                      ) : (
                                        <AppLink
                                          href={`/app/lesson/${step.lessonId}`}
                                          className="block transition-opacity active:opacity-65"
                                        >
                                          {inner}
                                        </AppLink>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>

                              <div className="mt-3 space-y-2">
                                {isDoneCourse ? (
                                  <button
                                    type="button"
                                    onClick={() => setActiveTab("explore")}
                                    className="flex h-11 w-full items-center justify-center rounded-2xl bg-brand text-sm font-bold text-white transition-transform active:scale-[0.98]"
                                  >
                                    다음 강좌 찾기
                                  </button>
                                ) : courseNext ? (
                                  <AppLinkButton
                                    href={`/app/lesson/${courseNext.lessonId}`}
                                    variant="primary"
                                    size="md"
                                    className="w-full"
                                  >
                                    {isUnstarted ? "강좌 시작하기" : "이어서 수강하기"}
                                  </AppLinkButton>
                                ) : null}

                                {course.steps.length > 4 && (
                                  <AppLink
                                    href={`/app/courses/${course.courseId}?dogId=${selectedDogId}`}
                                    className="flex items-center justify-center gap-0.5 py-1 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
                                  >
                                    전체 {course.steps.length}강 목차 보기
                                    <ChevronRight className="size-3.5" strokeWidth={2} />
                                  </AppLink>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : (
              /* 수강 중인 강좌가 없는 반려견(예: 보리)용 심플 시작 카드 */
              <section className="space-y-4 rounded-3xl bg-surface-subtle p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-brand-strong">첫 강좌 추천</p>
                  <AppLink
                    href="/app/my/goal"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-ink transition-opacity active:opacity-70"
                  >
                    <Target className="size-3.5 text-brand" strokeWidth={2.2} />
                    오늘 0/{dailyGoal}
                  </AppLink>
                </div>

                <div>
                  <h1 className="text-xl font-extrabold leading-snug tracking-tight text-ink">
                    {selectedDog.name}의 첫 강좌를 시작해 볼까요?
                  </h1>
                  {starterCourse && (
                    <p className="mt-1 text-xs font-medium text-ink">
                      추천 강좌 · Lv.{starterCourse.level} {starterCourse.title}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  {starterCourse ? (
                    <AppLinkButton
                      href={`/app/courses/${starterCourse.id}?dogId=${selectedDogId}`}
                      variant="primary"
                      size="lg"
                      className="flex-1"
                    >
                      추천 강좌 시작
                    </AppLinkButton>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setActiveTab("explore")}
                    className="inline-flex h-12 shrink-0 items-center justify-center rounded-2xl bg-surface px-4 text-sm font-bold text-ink transition-transform active:scale-[0.98]"
                  >
                    전체 찾기
                  </button>
                </div>
              </section>
            )}

            {/* 3. 훈련사 1:1 영상 Q&A 바로가기 */}
            <section>
              <AppLink
                href="/app/inquiry"
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface-subtle px-4 py-3.5 transition-opacity active:opacity-75"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <MessageSquareText className="size-5 shrink-0 text-sky-600" strokeWidth={2} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">훈련사 1:1 영상 Q&amp;A</p>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      영상을 올리면 48시간 내 맞춤 피드백
                    </p>
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-ink-muted" strokeWidth={2} />
              </AppLink>
            </section>
          </div>
        )}

        {/* ========== TAB 2: 교육 찾기 (영상 200개 확장 대비 — 검색 + 필터 + 전체 코스) ========== */}
        {activeTab === "explore" && (
          <div className="space-y-4">
            {/* 실시간 검색창 */}
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
                strokeWidth={2}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="강좌명 · 강의 주제로 검색 (예: 산책, 짖음)"
                aria-label="강좌 검색"
                className="h-11 w-full rounded-2xl bg-surface-subtle pl-10 pr-9 text-sm text-ink placeholder:text-ink-muted focus:bg-surface focus:outline-none focus:ring-1.5 focus:ring-brand"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="검색어 지우기"
                  className="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-ink/[0.08] text-ink-muted"
                >
                  <X className="size-3.5" strokeWidth={2.2} />
                </button>
              )}
            </div>

            {/* 가로 100% 풀블리드 필터 스와이퍼 (포인트샵 카테고리와 동일 패턴) */}
            <div
              ref={filterTrackRef}
              {...filterDragProps}
              role="tablist"
              aria-label="강좌 필터"
              className="no-scrollbar swipe-x -mx-4 flex select-none gap-1.5 overflow-x-auto px-4 pb-0.5 scroll-px-4 cursor-grab active:cursor-grabbing"
            >
              {filterChips.map((chip) => {
                const active = exploreFilter === chip.key;
                return (
                  <button
                    key={chip.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-active={active ? "true" : "false"}
                    onClick={() => setExploreFilter(chip.key)}
                    className={cn(
                      "shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors active:scale-[0.97]",
                      active
                        ? "bg-ink text-surface"
                        : "bg-surface-subtle text-ink-muted hover:text-ink",
                    )}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* 강좌 카운트 & 결과 리스트 */}
            <div className="flex items-baseline justify-between pt-0.5">
              <h2 className="text-sm font-bold tracking-tight text-ink">전체 강좌</h2>
              <span className="text-xs font-semibold tabular-nums text-ink-muted">
                {filteredCatalog.length}개
              </span>
            </div>

            {filteredCatalog.length === 0 ? (
              <div className="space-y-3">
                <EmptyStateCard
                  mode="section"
                  icon={<BookOpen className="size-5" strokeWidth={1.8} />}
                  title="조건에 맞는 강좌가 없어요"
                  description="다른 검색어나 필터로 다시 찾아보세요."
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setExploreFilter("ALL");
                  }}
                  className="mx-auto block rounded-full bg-surface-subtle px-4 py-2 text-xs font-bold text-ink"
                >
                  필터 초기화
                </button>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {filteredCatalog.map(({ course, matchedLesson }) => {
                  const enr = enrollmentByCourseId.get(course.id);
                  const pct = enr
                    ? calcProgressPercent(enr.totalLessons, enr.doneLessons)
                    : 0;

                  const canQuickEnroll = !enr && course.isUnlocked;
                  const canRedeemTicket =
                    !enr && !course.isUnlocked && course.availableTicketId !== null;
                  const isEnrolling = enrollingCourseId === course.id;
                  const courseHref = `/app/courses/${course.id}?dogId=${selectedDogId}`;

                  return (
                    <li key={course.id}>
                      <div className="rounded-2xl border border-border-subtle bg-surface p-4 transition-colors hover:bg-surface-subtle/60">
                        <div className="flex items-start justify-between gap-3">
                          <AppLink
                            href={courseHref}
                            className="min-w-0 flex-1 transition-opacity active:opacity-70"
                          >
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                              <span className="font-bold tabular-nums text-ink">
                                Lv.{course.level}
                              </span>
                              <span className="tabular-nums text-ink-muted">
                                {course.lessonCount}강
                              </span>
                              {enr ? (
                                <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                                  <span
                                    aria-hidden="true"
                                    className="size-1.5 rounded-full bg-brand"
                                  />
                                  {enr.status === "COMPLETED" ? "완주" : `수강 중 ${pct}%`}
                                </span>
                              ) : course.isPremium ? (
                                canRedeemTicket ? (
                                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                                    <Ticket className="size-3" strokeWidth={2.2} />
                                    티켓 보유 · 0P
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 font-semibold text-ink-muted">
                                    {course.isUnlocked ? (
                                      <Unlock className="size-3 text-emerald-700" strokeWidth={2.2} />
                                    ) : (
                                      <Lock className="size-3" strokeWidth={2.2} />
                                    )}
                                    {course.isUnlocked
                                      ? "잠금해제"
                                      : course.pointPrice !== null
                                        ? `프리미엄 · ${course.pointPrice.toLocaleString("ko-KR")}P`
                                        : "프리미엄"}
                                  </span>
                                )
                              ) : (
                                <span className="font-semibold text-emerald-700">무료</span>
                              )}
                            </div>

                            <h3 className="mt-1 text-sm font-bold text-ink">{course.title}</h3>
                            {course.description && (
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                                {course.description}
                              </p>
                            )}
                            {matchedLesson && (
                              <p className="mt-1.5 truncate text-xs font-semibold text-emerald-700">
                                관련 강의 · {matchedLesson}
                              </p>
                            )}
                          </AppLink>

                          {canQuickEnroll ? (
                            <button
                              type="button"
                              onClick={() => void handleEnrollCourse(course)}
                              disabled={enrollLock.pending}
                              aria-label={`${course.title} 내 강좌에 담기`}
                              className="mt-0.5 inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft px-3.5 py-1.5 text-xs font-bold text-brand-strong transition-colors hover:bg-brand/20 active:scale-95 disabled:opacity-50"
                            >
                              {isEnrolling ? "담는 중" : "담기"}
                            </button>
                          ) : (
                            <AppLink
                              href={courseHref}
                              aria-label={`${course.title} 상세 보기`}
                              className="mt-1 shrink-0 text-ink-muted"
                            >
                              <ChevronRight className="size-4" strokeWidth={2} />
                            </AppLink>
                          )}
                        </div>

                        {enr && (
                          <AppLink
                            href={courseHref}
                            aria-label={`${course.title} 진도율 ${pct}%`}
                            className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-subtle"
                          >
                            <div
                              className="waggle-progress-flow h-full rounded-full transition-[width] duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </AppLink>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
    </div>
  );
}
