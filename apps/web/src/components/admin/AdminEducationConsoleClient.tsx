"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, RefreshCw, SlidersHorizontal } from "lucide-react";
import type { GradeTierPolicy } from "@repo/types";
import { useAdminAlertStore } from "@/01_store/admin/useAdminAlertStore";
import { useSubmitLock } from "@/02_hooks/useSubmitLock";
import {
  adminBulkUpdateCoursesAction,
  adminSyncAllDogGradesAction,
  adminUpdateEducationPoliciesAction,
} from "@/03_actions/admin/adminEducationMatchingActions";
import type { EducationPolicies } from "@/04_services/shared/policyService";
import {
  AdminButton,
  AdminSearchInput,
  AdminSelect,
  AdminStatusBadge,
} from "@/components/admin/ui";

export interface AdminCourseRowItem {
  id: number;
  code: string;
  title: string;
  level: number;
  isPremium: boolean;
  isPublished: boolean;
  unitCount: number;
  lessonCount: number;
}

export function AdminEducationConsoleClient({
  initialPolicies,
  courses,
}: {
  initialPolicies: EducationPolicies;
  courses: AdminCourseRowItem[];
}) {
  const router = useRouter();
  const openAlert = useAdminAlertStore((s) => s.openAlert);
  const policyLock = useSubmitLock();
  const syncLock = useSubmitLock();
  const bulkLock = useSubmitLock();

  const [policyOpen, setPolicyOpen] = useState(false);
  const [tiers, setTiers] = useState<GradeTierPolicy[]>(initialPolicies.gradeTiers);
  const [watchPct, setWatchPct] = useState(String(initialPolicies.watchCompletePercent));
  const [quizPct, setQuizPct] = useState(String(initialPolicies.quizPassPercent));
  const [levelTestPct, setLevelTestPct] = useState(String(initialPolicies.levelTestPassScorePct));
  const [pointWatch, setPointWatch] = useState(String(initialPolicies.pointWatch));
  const [pointPractice, setPointPractice] = useState(String(initialPolicies.pointPractice));
  const [pointQuiz, setPointQuiz] = useState(String(initialPolicies.pointQuiz));
  const [pointBonusUnit, setPointBonusUnit] = useState(String(initialPolicies.pointBonusUnit));
  const [pointBonusCourse, setPointBonusCourse] = useState(String(initialPolicies.pointBonusCourse));
  const [pointDailyCap, setPointDailyCap] = useState(String(initialPolicies.pointDailyEarnCap));

  // 필터 & 코스 다중 선택 (200개 영상/다수 코스 일괄 편집)
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [publishFilter, setPublishFilter] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkLevel, setBulkLevel] = useState<string>("");
  const [bulkPremium, setBulkPremium] = useState<string>("");
  const [bulkPublished, setBulkPublished] = useState<string>("");

  const filteredCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      if (q && !c.title.toLowerCase().includes(q) && !c.code.toLowerCase().includes(q)) {
        return false;
      }
      if (levelFilter !== "ALL" && String(c.level) !== levelFilter) return false;
      if (publishFilter === "PUBLISHED" && !c.isPublished) return false;
      if (publishFilter === "DRAFT" && c.isPublished) return false;
      return true;
    });
  }, [courses, query, levelFilter, publishFilter]);

  const allFilteredSelected =
    filteredCourses.length > 0 && filteredCourses.every((c) => selectedIds.includes(c.id));

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredSet = new Set(filteredCourses.map((c) => c.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...filteredCourses.map((c) => c.id)]);
      setSelectedIds(Array.from(merged));
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const updateTier = (index: number, patch: Partial<GradeTierPolicy>) => {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  const handleSavePolicies = (e: React.FormEvent) => {
    e.preventDefault();
    void policyLock.run(async () => {
      const res = await adminUpdateEducationPoliciesAction({
        gradeTiers: tiers,
        watchCompletePercent: Number(watchPct),
        quizPassPercent: Number(quizPct),
        levelTestPassScorePct: Number(levelTestPct),
        pointWatch: Number(pointWatch),
        pointPractice: Number(pointPractice),
        pointQuiz: Number(pointQuiz),
        pointBonusUnit: Number(pointBonusUnit),
        pointBonusCourse: Number(pointBonusCourse),
        pointDailyEarnCap: Number(pointDailyCap),
      });
      if (!res.ok) {
        openAlert({ title: "교육 정책 저장 실패", description: res.error.message, tone: "negative" });
        return;
      }
      router.refresh();
      openAlert({
        title: "교육 점수 · 학년 정책이 일괄 저장되었습니다",
        description:
          res.data.updatedKeys > 0
            ? `${res.data.updatedKeys}개 정책 키가 갱신되고 변경 이력에 기록되었습니다.`
            : "변경된 항목이 없습니다.",
      });
    });
  };

  const handleSyncGrades = () => {
    openAlert({
      title: "전체 반려견 학년을 동기화할까요?",
      description:
        "저장된 학년 기준(누적 완료 강의 수)에 따라 승급 대상 반려견을 일괄 반영합니다. 이미 달성한 학년은 강등되지 않습니다.",
      confirmLabel: "동기화 실행",
      cancelLabel: "취소",
      onConfirm: async () => {
        await syncLock.run(async () => {
          const res = await adminSyncAllDogGradesAction({ allowDemotion: false });
          if (!res.ok) {
            openAlert({ title: "학년 동기화 실패", description: res.error.message, tone: "negative" });
            return;
          }
          router.refresh();
          openAlert({
            title: "전체 반려견 학년 동기화 완료",
            description: `총 ${res.data.totalDogs}마리 중 ${res.data.updatedCount}마리의 학년이 갱신되었습니다.`,
          });
        });
      },
    });
  };

  const handleApplyBulk = () => {
    if (selectedIds.length === 0) return;
    if (!bulkLevel && !bulkPremium && !bulkPublished) {
      openAlert({ title: "변경할 항목을 선택해 주세요", description: "레벨 · 유형 · 게시 상태 중 최소 1개를 지정해 주세요." });
      return;
    }

    void bulkLock.run(async () => {
      const res = await adminBulkUpdateCoursesAction({
        courseIds: selectedIds,
        level: bulkLevel ? Number(bulkLevel) : undefined,
        isPremium: bulkPremium === "" ? undefined : bulkPremium === "PREMIUM",
        isPublished: bulkPublished === "" ? undefined : bulkPublished === "PUBLISHED",
      });
      if (!res.ok) {
        openAlert({ title: "강좌 일괄 변경 실패", description: res.error.message, tone: "negative" });
        return;
      }
      setSelectedIds([]);
      setBulkLevel("");
      setBulkPremium("");
      setBulkPublished("");
      router.refresh();
      openAlert({
        title: `${res.data.updatedCount}개 강좌가 일괄 변경되었습니다`,
      });
    });
  };

  const tierSummaryText = tiers.map((t) => `${t.minLessons}`).join(" / ");

  return (
    <div className="space-y-4">
      {/* 상단 일괄 정책 바 (교육 점수 · 포인트 · 1~5학년 승급 기준 SSOT) */}
      <section className="overflow-hidden rounded-panel bg-base-1 atlas-border">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-base-2 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setPolicyOpen((prev) => !prev)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <SlidersHorizontal className="size-3.5 shrink-0 text-info" strokeWidth={1.9} />
            <span className="text-xs font-semibold text-neutral">
              교육 점수 · 포인트 · 학년 승급 기준 일괄 설정
            </span>
            <span className="hidden truncate font-mono text-xs tabular-nums text-subdued md:inline">
              시청 {watchPct}% · 퀴즈 {quizPct}% · 1~5학년({tierSummaryText}강)
            </span>
            <ChevronDown
              className={`size-3.5 shrink-0 text-secondary transition-transform ${policyOpen ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={syncLock.pending}
              onClick={handleSyncGrades}
              className="inline-flex h-7 items-center gap-1 rounded-control bg-base-1 px-2.5 text-xs font-medium text-neutral atlas-border hover:bg-base-2 disabled:opacity-50"
            >
              <RefreshCw className={`size-3 ${syncLock.pending ? "animate-spin" : ""}`} strokeWidth={1.8} />
              학년 동기화
            </button>
            <Link href="/admin/policies" className="text-xs text-info hover:underline">
              전체 정책 →
            </Link>
          </div>
        </div>

        {policyOpen && (
          <form onSubmit={handleSavePolicies} noValidate className="space-y-4 p-4 atlas-border-t">
            {/* 1. 강아지 1~5학년 승급 기준 */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <h2 className="text-xs font-semibold text-neutral">
                  1. 강아지 1~5학년 승급 기준 (누적 완료 강의 수)
                </h2>
                <p className="text-xs text-subdued">
                  영상이 200개로 늘어나도 여기서 기준 숫자만 조정하면 전 화면에 즉시 반영됩니다.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-5">
                {tiers.map((tier, idx) => (
                  <div key={tier.grade} className="space-y-1.5 rounded-control bg-base-2 p-2.5 atlas-border">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-info">
                        {tier.grade}단계
                      </span>
                      <span className="text-xs text-subdued">
                        {idx === 0 ? "입학 기본" : "승급 기준"}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={tier.title}
                      onChange={(e) => updateTier(idx, { title: e.target.value })}
                      aria-label={`${tier.grade}학년 명칭`}
                      className="h-7 w-full rounded-control bg-base-1 px-2 text-xs text-neutral atlas-border"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={idx === 0 ? 0 : 1}
                        disabled={idx === 0}
                        value={tier.minLessons}
                        onChange={(e) =>
                          updateTier(idx, { minLessons: Math.max(0, Number(e.target.value) || 0) })
                        }
                        aria-label={`${tier.grade}학년 필요 강의 수`}
                        className="h-7 w-full rounded-control bg-base-1 px-2 font-mono text-xs tabular-nums text-neutral atlas-border disabled:bg-base-2 disabled:text-subdued"
                      />
                      <span className="shrink-0 text-xs text-subdued">강</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. 평가 · 점수 기준 (%) */}
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-neutral">
                2. 전 강의 · 퀴즈 기본 통과 기준 (개별 퀴즈 예외 설정 시 개별값 우선)
              </h2>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs text-secondary">영상 시청 완료 판정 (%)</span>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={watchPct}
                    onChange={(e) => setWatchPct(e.target.value)}
                    className="h-7 w-full rounded-control bg-base-2 px-2.5 font-mono text-xs tabular-nums atlas-border"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-secondary">퀴즈 기본 통과 점수 (%)</span>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={quizPct}
                    onChange={(e) => setQuizPct(e.target.value)}
                    className="h-7 w-full rounded-control bg-base-2 px-2.5 font-mono text-xs tabular-nums atlas-border"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-secondary">레벨테스트 통과 점수 (%)</span>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={levelTestPct}
                    onChange={(e) => setLevelTestPct(e.target.value)}
                    className="h-7 w-full rounded-control bg-base-2 px-2.5 font-mono text-xs tabular-nums atlas-border"
                  />
                </label>
              </div>
            </div>

            {/* 3. 교육 포인트 기본 적립 단가 */}
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-neutral">
                3. 교육 적립 포인트 기본 단가 (P)
              </h2>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <label className="space-y-1">
                  <span className="text-xs text-secondary">영상 시청</span>
                  <input
                    type="number"
                    min={0}
                    value={pointWatch}
                    onChange={(e) => setPointWatch(e.target.value)}
                    className="h-7 w-full rounded-control bg-base-2 px-2.5 font-mono text-xs tabular-nums atlas-border"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-secondary">실습 체크</span>
                  <input
                    type="number"
                    min={0}
                    value={pointPractice}
                    onChange={(e) => setPointPractice(e.target.value)}
                    className="h-7 w-full rounded-control bg-base-2 px-2.5 font-mono text-xs tabular-nums atlas-border"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-secondary">퀴즈 통과</span>
                  <input
                    type="number"
                    min={0}
                    value={pointQuiz}
                    onChange={(e) => setPointQuiz(e.target.value)}
                    className="h-7 w-full rounded-control bg-base-2 px-2.5 font-mono text-xs tabular-nums atlas-border"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-secondary">챕터 보너스</span>
                  <input
                    type="number"
                    min={0}
                    value={pointBonusUnit}
                    onChange={(e) => setPointBonusUnit(e.target.value)}
                    className="h-7 w-full rounded-control bg-base-2 px-2.5 font-mono text-xs tabular-nums atlas-border"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-secondary">강좌 보너스</span>
                  <input
                    type="number"
                    min={0}
                    value={pointBonusCourse}
                    onChange={(e) => setPointBonusCourse(e.target.value)}
                    className="h-7 w-full rounded-control bg-base-2 px-2.5 font-mono text-xs tabular-nums atlas-border"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-secondary">일일 적립 상한</span>
                  <input
                    type="number"
                    min={0}
                    value={pointDailyCap}
                    onChange={(e) => setPointDailyCap(e.target.value)}
                    className="h-7 w-full rounded-control bg-base-2 px-2.5 font-mono text-xs tabular-nums atlas-border"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPolicyOpen(false)}
                className="h-7 rounded-control bg-base-2 px-3 text-xs font-medium text-secondary atlas-border hover:text-neutral"
              >
                접기
              </button>
              <button
                type="submit"
                disabled={policyLock.pending}
                className="h-7 rounded-control bg-inverse px-3.5 text-xs font-medium text-on-inverse disabled:opacity-50"
              >
                {policyLock.pending ? "저장 중..." : "일괄 정책 저장"}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* 필터 바 + 다중 선택 강좌 일괄 작업 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-panel bg-base-2 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <AdminSearchInput
            value={query}
            onChange={setQuery}
            sizeVariant="compact"
            placeholder="강좌명 · 코드 검색"
            ariaLabel="강좌명 · 코드 검색"
            className="w-52"
          />
          <AdminSelect
            value={levelFilter}
            onValueChange={setLevelFilter}
            ariaLabel="레벨 필터"
            size="sm"
            className="w-28"
            options={[
              { value: "ALL", label: "전체 레벨" },
              ...[1, 2, 3, 4, 5].map((lv) => ({ value: String(lv), label: `Lv.${lv}` })),
            ]}
          />
          <AdminSelect
            value={publishFilter}
            onValueChange={setPublishFilter}
            ariaLabel="게시 상태 필터"
            size="sm"
            className="w-32"
            options={[
              { value: "ALL", label: "전체 상태" },
              { value: "PUBLISHED", label: "PUBLISHED" },
              { value: "DRAFT", label: "DRAFT" },
            ]}
          />
          <span className="font-mono text-xs tabular-nums text-subdued">
            {filteredCourses.length} / {courses.length} 강좌
          </span>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs font-semibold tabular-nums text-info">
              {selectedIds.length}개 선택
            </span>
            <AdminSelect
              value={bulkLevel}
              onValueChange={setBulkLevel}
              ariaLabel="일괄 레벨 변경"
              size="sm"
              className="w-32"
              options={[
                { value: "", label: "레벨 유지" },
                ...[1, 2, 3, 4, 5].map((lv) => ({
                  value: String(lv),
                  label: `Lv.${lv}로 변경`,
                })),
              ]}
            />
            <AdminSelect
              value={bulkPremium}
              onValueChange={setBulkPremium}
              ariaLabel="일괄 유형 변경"
              size="sm"
              className="w-28"
              options={[
                { value: "", label: "유형 유지" },
                { value: "FREE", label: "FREE" },
                { value: "PREMIUM", label: "PREMIUM" },
              ]}
            />
            <AdminSelect
              value={bulkPublished}
              onValueChange={setBulkPublished}
              ariaLabel="일괄 게시 상태 변경"
              size="sm"
              className="w-32"
              options={[
                { value: "", label: "게시 유지" },
                { value: "PUBLISHED", label: "PUBLISHED" },
                { value: "DRAFT", label: "DRAFT" },
              ]}
            />
            <AdminButton
              variant="solid"
              size="md"
              loading={bulkLock.pending}
              onClick={handleApplyBulk}
            >
              {bulkLock.pending ? "적용 중..." : "일괄 적용"}
            </AdminButton>
          </div>
        )}
      </div>

      {/* 코스 목록 테이블 */}
      <div className="overflow-x-auto rounded-panel bg-base-1 atlas-border">
        <table className="w-full min-w-full text-left">
          <thead>
            <tr className="h-9 bg-base-2 text-xs text-secondary atlas-border-b">
              <th className="w-9 py-2 pl-3 pr-1">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAllFiltered}
                  aria-label="현재 목록 전체 선택"
                  className="size-3.5 align-middle"
                />
              </th>
              <th className="px-3 py-2 whitespace-nowrap">코드</th>
              <th className="min-w-48 px-3 py-2 whitespace-nowrap">강좌명</th>
              <th className="px-3 py-2 whitespace-nowrap">레벨</th>
              <th className="px-3 py-2 whitespace-nowrap text-right">챕터 / 강의</th>
              <th className="px-3 py-2 whitespace-nowrap">유형</th>
              <th className="py-2 pl-3 pr-4 text-right whitespace-nowrap">게시 상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline text-sm">
            {filteredCourses.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-xs text-subdued">
                  조건에 맞는 강좌가 없습니다.
                </td>
              </tr>
            ) : (
              filteredCourses.map((c) => {
                const checked = selectedIds.includes(c.id);
                return (
                  <tr
                    key={c.id}
                    className={
                      checked
                        ? "bg-base-2/80"
                        : "hover:bg-[var(--mix-table-hover)]"
                    }
                  >
                    <td className="py-2.5 pl-3 pr-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(c.id)}
                        aria-label={`${c.title} 선택`}
                        className="size-3.5 align-middle"
                      />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap text-secondary">
                      {c.code}
                    </td>
                    <td className="min-w-48 px-3 py-2.5">
                      <Link
                        href={`/admin/education/${c.id}`}
                        className="block font-medium text-info hover:underline"
                      >
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap tabular-nums">
                      Lv.{c.level}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap tabular-nums text-secondary">
                      {c.unitCount}챕터 · {c.lessonCount}강
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <AdminStatusBadge tone={c.isPremium ? "warning" : "neutral"}>
                        {c.isPremium ? "PREMIUM" : "FREE"}
                      </AdminStatusBadge>
                    </td>
                    <td className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">
                      <AdminStatusBadge tone={c.isPublished ? "positive" : "neutral"}>
                        {c.isPublished ? "PUBLISHED" : "DRAFT"}
                      </AdminStatusBadge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
