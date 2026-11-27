"use client";

import Link from "next/link";
import { useRef, type MouseEvent } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight, BookOpen, Crown, PlayCircle } from "lucide-react";
import styles from "../landing.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export interface WwwCourseItem {
  id: number;
  title: string;
  description: string | null;
  level: number;
  isPremium: boolean;
  lessonCount: number;
}

const AURORA_CYCLE = [styles.auroraBrand, styles.auroraEmerald, styles.auroraSky] as const;

export function WwwCoursesSection({ courses }: { courses: WwwCourseItem[] }) {
  const sectionRef = useRef<HTMLElement | null>(null);

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Desktop: Multi-speed depth parallax per column (Col 0: ±24, Col 1: ±48, Col 2: ±18)
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const speeds: Record<string, [number, number]> = {
          "0": [24, -24],
          "1": [48, -44],
          "2": [18, -18],
        };

        Object.entries(speeds).forEach(([col, [fromY, toY]]) => {
          const targets = gsap.utils.toArray<HTMLElement>(`[data-course-col="${col}"]`);
          if (targets.length === 0) return;

          gsap.fromTo(
            targets,
            { y: fromY },
            {
              y: toY,
              ease: "none",
              scrollTrigger: {
                trigger: sectionRef.current,
                start: "top bottom",
                end: "bottom top",
                scrub: 0.6,
                invalidateOnRefresh: true,
              },
            },
          );
        });
      });

      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  return (
    <section
      id="courses"
      ref={sectionRef}
      className="relative border-t border-border-subtle py-20 sm:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
              <BookOpen className="size-3.5" strokeWidth={2.2} />
              CURATED CURRICULUM
            </span>
            <h2 className="text-balance text-3xl font-extrabold leading-[1.2] tracking-tight text-ink sm:text-4xl">
              지금 바로 시작할 수 있는
              <br />
              와글 대표 커리큘럼
            </h2>
          </div>

          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-brand hover:underline"
          >
            <span>전체 강좌 앱에서 보기</span>
            <ArrowRight className="size-4" strokeWidth={2.2} />
          </Link>
        </div>

        {/* Desktop 3-Column Multi-Speed Depth Grid / Mobile Swipe Carousel */}
        <div className="swipe-x no-scrollbar mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:pb-0">
          {courses.map((course, idx) => {
            const colIndex = idx % 3;
            const auroraClass = AURORA_CYCLE[colIndex];
            return (
              <article
                key={course.id}
                data-course-col={String(colIndex)}
                onMouseMove={handleMouseMove}
                className={[
                  styles.auroraCard,
                  auroraClass,
                  "flex w-[84vw] max-w-[22rem] shrink-0 snap-center flex-col justify-between rounded-3xl border border-border-subtle bg-surface p-6 shadow-xs lg:w-auto lg:max-w-none lg:p-7",
                ].join(" ")}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-lg bg-surface-subtle px-2.5 py-1 text-xs font-extrabold text-ink tabular-nums">
                      Lv.{course.level}
                    </span>

                    {course.isPremium ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/14 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                        <Crown className="size-3.5" strokeWidth={2.2} />
                        프리미엄
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-lg bg-emerald-500/12 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        무료 강좌
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 text-lg font-extrabold leading-snug tracking-tight text-ink">
                    {course.title}
                  </h3>

                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted">
                    {course.description ||
                      "전문 훈련사가 설계한 단계별 영상·실습·퀴즈 루프로 우리 강아지와 즐겁게 연습해 보세요."}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-border-subtle pt-4">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted tabular-nums">
                    <PlayCircle className="size-4 text-brand" strokeWidth={2} />
                    {course.lessonCount > 0 ? `${course.lessonCount}개 강의` : "단계별 커리큘럼"}
                  </span>

                  <Link
                    href="/app"
                    className="inline-flex items-center gap-1 text-xs font-bold text-ink transition-colors hover:text-brand"
                  >
                    <span>앱에서 시작하기</span>
                    <ArrowRight className="size-3.5" strokeWidth={2.2} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
