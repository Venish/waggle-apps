"use client";

import { useState } from "react";
import { scoreCourses } from "@repo/types";

interface TagItem {
  id: number;
  code: string;
  name: string;
  category: string;
}

interface CourseWithTags {
  id: number;
  title: string;
  tags: Array<{ code: string; weight: number }>;
}

export function MatchingSimulatorClient({
  tags,
  courses,
}: {
  tags: TagItem[];
  courses: CourseWithTags[];
}) {
  const [selectedCodes, setSelectedCodes] = useState<string[]>(["puppy", "prob_bark"]);

  const toggle = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const results = scoreCourses(
    selectedCodes.map((code) => ({ code, weight: 2 })),
    courses.map((c) => ({ courseId: c.id, tags: c.tags })),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-panel bg-base-2 p-4 space-y-3 atlas-border">
        <h3 className="text-sm font-semibold">가상 반려견 태그 선택</h3>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const active = selectedCodes.includes(t.code);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.code)}
                className={`h-7 rounded-control px-2.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-inverse text-on-inverse"
                    : "bg-base-1 text-secondary atlas-border hover:text-neutral"
                }`}
              >
                {t.name} ({t.code})
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-panel bg-base-2 p-4 space-y-3 atlas-border">
        <h3 className="text-sm font-semibold">실시간 추천 순위 시뮬레이션 결과</h3>
        {results.length === 0 ? (
          <p className="text-xs text-subdued">일치하는 강좌가 없습니다. 태그를 선택해 보세요.</p>
        ) : (
          <ul className="space-y-2">
            {results.map((r, idx) => {
              const c = courses.find((x) => x.id === r.courseId);
              return (
                <li key={r.courseId} className="rounded-control bg-base-1 p-3 atlas-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {idx + 1}위. {c?.title}
                    </span>
                    <span className="font-mono text-sm font-bold text-positive tabular-nums">
                      {r.score}점
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-subdued">
                    매칭 태그: {r.matchedTags.join(", ")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
