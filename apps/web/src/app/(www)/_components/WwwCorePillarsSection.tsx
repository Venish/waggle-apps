"use client";

import { useRef, useState, type MouseEvent } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  CalendarCheck2,
  CheckCircle2,
  Gift,
  GraduationCap,
  Play,
  Video,
} from "lucide-react";
import styles from "../landing.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface PillarSpec {
  step: string;
  enLabel: string;
  title: string;
  desc: string;
  tone: "brand" | "emerald" | "sky";
  icon: typeof GraduationCap;
  highlights: readonly string[];
  metricLabel: string;
  metricValue: string;
}

const PILLARS: PillarSpec[] = [
  {
    step: "01",
    enLabel: "Personal Curriculum",
    title: "맞춤 커리큘럼 & 3단계 교육 루프",
    desc: "7문항 성향 설문으로 우리 강아지에게 꼭 맞는 강좌를 매칭하고, 영상 시청(95%) → 자가 실습 체크 → 퀴즈 통과 3단계로 완주율과 실전 효과를 높입니다.",
    tone: "brand",
    icon: GraduationCap,
    highlights: ["7문항 성향 설문 매칭", "배속 지원 집중 영상 학습", "실습 체크 + 4지선다 퀴즈 보상"],
    metricLabel: "하루 권장 루틴",
    metricValue: "매일 5분 · 3단계",
  },
  {
    step: "02",
    enLabel: "Daily & Health Log",
    title: "데일리 & 건강 캘린더",
    desc: "산책·놀이·교육 일상을 날짜별로 기록하고 한눈에 돌아볼 수 있습니다. 사진 갤러리, 체중 변화 추이, 예방접종 일정까지 한 화면에 모아두세요.",
    tone: "emerald",
    icon: CalendarCheck2,
    highlights: ["월간 데일리 캘린더", "반려견별 사진 갤러리", "체중 그래프 & 예방접종 알림"],
    metricLabel: "누적 성장 기록",
    metricValue: "다견 프로필 무제한",
  },
  {
    step: "03",
    enLabel: "Rewards & Trainer Q&A",
    title: "포인트샵 & 훈련사 1:1 영상 Q&A",
    desc: "교육 완주와 데일리 기록으로 쌓은 포인트로 간식·용품·프리미엄 강좌를 교환하세요. 고민되는 행동 영상을 올리면 전문 훈련사가 48시간 내 맞춤 피드백을 드립니다.",
    tone: "sky",
    icon: Gift,
    highlights: ["학습·기록 즉시 포인트 적립", "간식·프리미엄 강좌 포인트 교환", "48시간 내 훈련사 1:1 영상 피드백"],
    metricLabel: "전문가 피드백",
    metricValue: "48시간 이내 답변",
  },
];

const TONE_MAP = {
  brand: {
    aurora: styles.auroraBrand,
    badge: "bg-brand-soft text-brand",
    iconBox: "bg-brand text-on-brand",
    dot: "bg-brand",
  },
  emerald: {
    aurora: styles.auroraEmerald,
    badge: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    iconBox: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-neutral-950",
    dot: "bg-emerald-500",
  },
  sky: {
    aurora: styles.auroraSky,
    badge: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    iconBox: "bg-sky-600 text-white dark:bg-sky-400 dark:text-neutral-950",
    dot: "bg-sky-500",
  },
} as const;

export function WwwCorePillarsSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const pinWrapRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const mobileCarouselRef = useRef<HTMLDivElement | null>(null);
  const [mobileIndex, setMobileIndex] = useState(0);

  const handleCardMouseMove = (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Desktop (>=1024px): Horizontal Scroll Pinning
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const pinWrap = pinWrapRef.current;
        const rail = railRef.current;
        if (!pinWrap || !rail) return;

        const getScrollDistance = () => {
          return Math.max(0, rail.scrollWidth - pinWrap.clientWidth);
        };

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: pinWrap,
            start: "top top",
            end: () => `+=${Math.max(560, getScrollDistance() * 1.35)}`,
            pin: true,
            scrub: 0.65,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        tl.to(
          rail,
          {
            x: () => -getScrollDistance(),
            ease: "none",
          },
          0,
        );

        if (progressBarRef.current) {
          tl.fromTo(
            progressBarRef.current,
            { scaleX: 0.12 },
            { scaleX: 1, ease: "none" },
            0,
          );
        }
      });

      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  const handleMobileScroll = () => {
    const el = mobileCarouselRef.current;
    if (!el) return;
    const cardWidth = el.clientWidth * 0.85;
    if (cardWidth <= 0) return;
    const nextIdx = Math.round(el.scrollLeft / cardWidth);
    setMobileIndex(Math.min(PILLARS.length - 1, Math.max(0, nextIdx)));
  };

  return (
    <section
      id="features"
      ref={sectionRef}
      className="relative border-t border-border-subtle bg-surface-subtle/50"
    >
      {/* Desktop Horizontal Pinning Stage (>=1024px) */}
      <div
        ref={pinWrapRef}
        className="hidden lg:flex lg:min-h-screen lg:flex-col lg:justify-center lg:overflow-hidden lg:py-16"
      >
        <div className="mx-auto w-full max-w-6xl px-8">
          <div className="flex items-end justify-between gap-8">
            <div>
              <h2 className="text-balance text-4xl font-extrabold leading-[1.18] tracking-tight text-ink">
                교육부터 기록, 보상까지
                <br />
                하나로 연결된 <span className="text-brand">3가지 핵심 축</span>
              </h2>
            </div>

            {/* Horizontal Scroll Progress Indicator */}
            <div className="w-56 space-y-2 pb-1">
              <div className="flex items-center justify-between text-xs font-bold text-ink-muted">
                <span>스크롤하여 탐색</span>
                <span className="tabular-nums text-brand">01 — 03</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-subtle">
                <div
                  ref={progressBarRef}
                  className="h-full w-full origin-left rounded-full bg-brand"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 w-full overflow-hidden motion-reduce:overflow-x-auto">
          <div
            ref={railRef}
            className="flex w-max items-stretch gap-6 pl-[max(2rem,calc((100vw-72rem)/2+2rem))] pr-[max(2rem,calc((100vw-72rem)/2+2rem))]"
          >
            {PILLARS.map((pillar) => {
              const toneStyle = TONE_MAP[pillar.tone];
              const Icon = pillar.icon;
              return (
                <article
                  key={pillar.step}
                  onMouseMove={handleCardMouseMove}
                  className={[
                    styles.auroraCard,
                    toneStyle.aurora,
                    "flex w-[31rem] shrink-0 flex-col justify-between rounded-3xl border border-border-subtle bg-surface p-8 shadow-sm",
                  ].join(" ")}
                >
                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <span className={`flex size-12 items-center justify-center rounded-2xl ${toneStyle.iconBox}`}>
                        <Icon className="size-6" strokeWidth={2} />
                      </span>
                      <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${toneStyle.badge}`}>
                        {pillar.step} · {pillar.enLabel}
                      </span>
                    </div>

                    <h3 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">
                      {pillar.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-ink-muted">{pillar.desc}</p>

                    <ul className="mt-6 space-y-2.5">
                      {pillar.highlights.map((hl) => (
                        <li
                          key={hl}
                          className="flex items-center gap-2.5 text-sm font-semibold text-ink"
                        >
                          <CheckCircle2 className="size-4 shrink-0 text-brand" strokeWidth={2.2} />
                          <span>{hl}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 flex items-center justify-between rounded-2xl bg-surface-subtle px-4 py-3">
                    <span className="text-xs font-semibold text-ink-muted">
                      {pillar.metricLabel}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-ink tabular-nums">
                      {pillar.tone === "brand" ? (
                        <Play className="size-3.5 text-brand" strokeWidth={2.5} />
                      ) : pillar.tone === "sky" ? (
                        <Video className="size-3.5 text-sky-500" strokeWidth={2.3} />
                      ) : (
                        <span className={`size-2 rounded-full ${toneStyle.dot}`} />
                      )}
                      {pillar.metricValue}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile & Tablet (<1024px): Native Horizontal Swipe Snap Carousel */}
      <div className="py-20 sm:py-24 lg:hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-balance text-3xl font-extrabold leading-[1.2] tracking-tight text-ink">
            교육부터 기록, 보상까지
            <br />
            하나로 연결된 <span className="text-brand">3가지 핵심 축</span>
          </h2>
        </div>

        <div
          ref={mobileCarouselRef}
          onScroll={handleMobileScroll}
          className="swipe-x no-scrollbar mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:px-6"
        >
          {PILLARS.map((pillar) => {
            const toneStyle = TONE_MAP[pillar.tone];
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.step}
                className="flex w-[86vw] max-w-[24rem] shrink-0 snap-center flex-col justify-between rounded-3xl border border-border-subtle bg-surface p-6 shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`flex size-11 items-center justify-center rounded-2xl ${toneStyle.iconBox}`}>
                      <Icon className="size-5" strokeWidth={2} />
                    </span>
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${toneStyle.badge}`}>
                      {pillar.step} · {pillar.enLabel}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-extrabold tracking-tight text-ink">
                    {pillar.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{pillar.desc}</p>
                  <ul className="mt-5 space-y-2">
                    {pillar.highlights.map((hl) => (
                      <li key={hl} className="flex items-center gap-2 text-xs font-semibold text-ink">
                        <CheckCircle2 className="size-3.5 shrink-0 text-brand" strokeWidth={2.2} />
                        <span>{hl}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-6 flex items-center justify-between rounded-2xl bg-surface-subtle px-3.5 py-2.5">
                  <span className="text-xs font-medium text-ink-muted">{pillar.metricLabel}</span>
                  <span className="text-xs font-extrabold text-ink tabular-nums">
                    {pillar.metricValue}
                  </span>
                </div>
              </article>
            );
          })}
        </div>

        {/* Carousel Dot Indicators */}
        <div className="mt-5 flex items-center justify-center gap-2" aria-hidden="true">
          {PILLARS.map((pillar, idx) => (
            <span
              key={pillar.step}
              className={[
                "h-2 rounded-full transition-[width,background-color] duration-200",
                idx === mobileIndex ? "w-6 bg-brand" : "w-2 bg-border-subtle",
              ].join(" ")}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
