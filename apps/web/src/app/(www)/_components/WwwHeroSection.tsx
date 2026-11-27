"use client";

import Image from "next/image";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { CalendarHeart, GraduationCap, PlayCircle } from "lucide-react";
import { PawStampIcon, PointIcon, WaggleMark } from "@repo/ui";
import styles from "../landing.module.css";
import { StoreBadgeButtons } from "./StoreBadgeButtons";
import { WwwHeroNetworkCanvas } from "./WwwHeroNetworkCanvas";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const HERO_CHIPS = [
  { icon: GraduationCap, label: "성향 설문 맞춤 매칭" },
  { icon: PlayCircle, label: "영상·실습·퀴즈 3단계" },
  { icon: CalendarHeart, label: "데일리 기록 & 포인트샵" },
] as const;

export function WwwHeroSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const scrollProgressRef = useRef(0);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Entrance choreography (runs once cleanly on load when motion allowed)
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-hero-enter]", {
          y: 24,
          opacity: 0,
          duration: 0.72,
          stagger: 0.08,
          ease: "power3.out",
          clearProps: "transform,opacity",
        });

        gsap.from("[data-hero-mockup]", {
          y: 36,
          scale: 0.96,
          opacity: 0,
          duration: 0.85,
          delay: 0.16,
          ease: "power3.out",
          clearProps: "transform,opacity",
        });
      });

      // Desktop scroll-driven 3D camera fly-through + counter-parallax depth
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
          onUpdate: (self) => {
            scrollProgressRef.current = self.progress;
          },
        });

        gsap.to("[data-hero-copy]", {
          y: -36,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: "bottom top",
            scrub: 0.5,
          },
        });

        gsap.to("[data-hero-mockup]", {
          y: -76,
          rotateZ: 1.8,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: "bottom top",
            scrub: 0.6,
          },
        });

        gsap.to("[data-hero-float='top']", {
          y: -104,
          x: -14,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: "bottom top",
            scrub: 0.7,
          },
        });

        gsap.to("[data-hero-float='bottom']", {
          y: -44,
          x: 16,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: "bottom top",
            scrub: 0.7,
          },
        });
      });

      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      className="relative isolate flex min-h-[100svh] w-full items-center pt-20 pb-16 sm:pt-24 sm:pb-20 lg:pt-24 lg:pb-20"
    >
      {/* Background: 100% Full-Bleed Three.js 3D Radial Outward Dog Constellation (opacity: 1) */}
      <WwwHeroNetworkCanvas scrollProgressRef={scrollProgressRef} />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8">
        {/* Left 7 Columns: Copy with Tight Localized Readability Dim */}
        <div
          data-hero-copy
          className={`${styles.heroTextDim} space-y-6 p-5 sm:p-7 lg:col-span-7 lg:p-8`}
        >
          <div data-hero-enter className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface/85 px-3.5 py-1.5 backdrop-blur-md">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-brand" />
            </span>
            <WaggleMark className="size-3.5 text-brand" />
            <span className="text-xs font-bold text-ink">반려견 맞춤 교육 · 데일리 기록 앱</span>
          </div>

          <h1
            data-hero-enter
            className="text-balance text-[2.25rem] font-extrabold leading-[1.16] tracking-tight text-ink sm:text-[3rem] lg:text-[3.5rem]"
          >
            매일 5분 맞춤 교육으로
            <br />
            <span className="text-brand">우리 강아지가 달라져요</span>
          </h1>

          <p
            data-hero-enter
            className="max-w-xl text-pretty text-base leading-relaxed text-ink-muted sm:text-lg"
          >
            반려견 성향 설문 매칭부터 영상·실습·퀴즈 3단계 교육 루프, 데일리·건강 기록,
            포인트샵과 훈련사 1:1 영상 Q&amp;A까지 보호자와 강아지의 하루를 하나로 잇습니다.
          </p>

          {/* 3 Core Value Chips */}
          <div data-hero-enter className="flex flex-wrap items-center gap-2">
            {HERO_CHIPS.map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface/85 px-3 py-1.5 text-xs font-semibold text-ink backdrop-blur-md"
              >
                <chip.icon className="size-3.5 text-brand" strokeWidth={2.2} />
                {chip.label}
              </span>
            ))}
          </div>

          {/* GodUI Store Badge Primary Row */}
          <div data-hero-enter className="pt-2">
            <StoreBadgeButtons size="md" theme="dark" qr />
          </div>
        </div>

        {/* Right 5 Columns: Titanium iPhone 3D Mockup with Real /app Capture */}
        <div className="relative flex justify-center lg:col-span-5 lg:justify-end">
          <div
            data-hero-mockup
            className="relative w-[17.5rem] sm:w-[19.25rem] lg:w-[20rem]"
          >
            <div className={styles.iphoneHalo} aria-hidden="true" />

            {/* Titanium iPhone Frame */}
            <div className={styles.iphoneFrame}>
              {/* Side Hardware Buttons */}
              <span
                aria-hidden="true"
                className="absolute -left-[3px] top-24 h-7 w-[3px] rounded-l bg-neutral-600"
              />
              <span
                aria-hidden="true"
                className="absolute -left-[3px] top-36 h-12 w-[3px] rounded-l bg-neutral-600"
              />
              <span
                aria-hidden="true"
                className="absolute -right-[3px] top-32 h-16 w-[3px] rounded-r bg-neutral-600"
              />

              <div className={styles.iphoneScreen}>
                {/* Dynamic Island */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-2.5 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-black/90"
                />

                <Image
                  src="/images/www/app-home-preview.webp"
                  alt="와글 모바일 앱 교육 홈 실제 화면"
                  width={390}
                  height={844}
                  priority
                  className="size-full object-cover object-top"
                />
                <div className={styles.iphoneGlass} aria-hidden="true" />
              </div>
            </div>

            {/* Floating Counter-Parallax Accent Pill (Mid-Left, Clear of Top Dog Card) */}
            <div
              data-hero-float="top"
              className="pointer-events-none absolute -left-14 top-52 hidden items-center gap-3 rounded-2xl bg-surface/94 px-3.5 py-2.5 shadow-[0_14px_34px_-10px_rgba(15,23,42,0.16)] ring-1 ring-ink/[0.07] backdrop-blur-xl dark:ring-white/[0.12] sm:flex"
            >
              <svg
                viewBox="0 0 36 36"
                fill="none"
                aria-hidden="true"
                className="size-9 shrink-0 text-brand"
              >
                <circle cx="18" cy="18" r="16" fill="currentColor" fillOpacity="0.14" />
                <circle cx="18" cy="18" r="12" stroke="currentColor" strokeWidth="2.4" />
                <circle cx="18" cy="18" r="7.2" stroke="currentColor" strokeWidth="2.4" strokeOpacity="0.55" />
                <circle cx="18" cy="18" r="3.4" fill="currentColor" />
              </svg>
              <div className="leading-tight">
                <p className="text-xs font-extrabold text-ink">오늘의 5분 미션</p>
                <p className="mt-1 inline-flex items-center gap-1 text-2xs font-semibold text-ink-muted tabular-nums">
                  <PointIcon className="size-3.5 text-brand" />
                  <span>퀴즈 통과 +100P 적립</span>
                </p>
              </div>
            </div>

            {/* Floating Counter-Parallax Accent Pill (Bottom Right) */}
            <div
              data-hero-float="bottom"
              className="pointer-events-none absolute -right-8 bottom-16 hidden items-center gap-3 rounded-2xl bg-surface/94 px-3.5 py-2.5 shadow-[0_14px_34px_-10px_rgba(15,23,42,0.16)] ring-1 ring-ink/[0.07] backdrop-blur-xl dark:ring-white/[0.12] sm:flex"
            >
              <PawStampIcon
                ringOpacity={1}
                pawOpacity={1}
                className="size-9 shrink-0 text-brand"
              />
              <div className="leading-tight">
                <p className="text-xs font-extrabold text-ink">초코 · 유치원 1학년</p>
                <p className="mt-1 text-2xs font-semibold text-ink-muted tabular-nums">
                  연속 7일 학습 · 일상 기록
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
