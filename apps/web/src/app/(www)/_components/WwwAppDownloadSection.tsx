"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  BellRing,
  Camera,
  PawPrint,
  Zap,
} from "lucide-react";
import styles from "../landing.module.css";
import { StoreBadgeButtons } from "./StoreBadgeButtons";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const APP_SPECS = [
  {
    icon: BellRing,
    title: "매일 5분 교육 푸시 리마인드",
    desc: "잊지 않고 꾸준히 이어가도록 원하는 시간에 알림을 보내드려요.",
  },
  {
    icon: Camera,
    title: "산책·데일리 사진 간편 기록",
    desc: "산책 직후 사진과 메모를 바로 남기고 우리 강아지의 일상을 기록하세요.",
  },
  {
    icon: PawPrint,
    title: "다견 프로필 & 빠른 전환",
    desc: "여러 마리 반려견도 프로필별 진도·체중·접종을 따로 관리해요.",
  },
  {
    icon: Zap,
    title: "빠른 학습 이어하기 & 자동 동기화",
    desc: "어디서든 수강하던 강의와 기록을 끊김 없이 이어서 볼 수 있어요.",
  },
] as const;

export function WwwAppDownloadSection() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Desktop: Perspective Tilt-to-Flat Scrub + counter-floating feature specs
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          "[data-download-stage]",
          { rotateX: 9, scale: 0.94, y: 40 },
          {
            rotateX: 0,
            scale: 1,
            y: 0,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 85%",
              end: "center center",
              scrub: 0.7,
              invalidateOnRefresh: true,
            },
          },
        );

        gsap.fromTo(
          "[data-download-specs]",
          { y: 24 },
          {
            y: -20,
            ease: "none",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.6,
            },
          },
        );
      });

      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  return (
    <section
      id="download"
      ref={sectionRef}
      className="relative border-t border-border-subtle bg-surface-subtle/50 py-20 sm:py-28 lg:py-32"
    >
      <div className={`${styles.perspectiveStage} mx-auto max-w-6xl px-4 sm:px-6 lg:px-8`}>
        <div
          data-download-stage
          className="relative grid gap-10 overflow-hidden rounded-3xl border border-border-subtle bg-surface p-7 shadow-sm sm:p-10 lg:grid-cols-12 lg:items-center lg:gap-12 lg:p-12"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-brand/12 blur-3xl"
          />

          {/* Left 7 Columns: Unified Closing Conversion Copy + GodUI Store Badges + Web App CTA */}
          <div className="relative z-10 space-y-6 lg:col-span-7">
            <h2 className="text-balance text-3xl font-extrabold leading-[1.2] tracking-tight text-ink sm:text-4xl">
              오늘 5분의 작은 습관,
              <br />
              <span className="text-brand">iOS · Android에서 더 편하게</span>
            </h2>

            <p className="max-w-lg text-pretty text-base leading-relaxed text-ink-muted">
              매일 5분 교육 리마인드부터 산책·데일리 기록, 훈련사 1:1 영상 Q&amp;A 답변 알림까지
              와글 앱에서 지금 바로 시작해 보세요.
            </p>

            {/* GodUI Store Badge Group */}
            <div className="pt-1">
              <StoreBadgeButtons size="md" theme="dark" qr />
            </div>
          </div>

          {/* Right 5 Columns: Support Spec Summary Cards */}
          <div data-download-specs className="grid gap-3 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
            {APP_SPECS.map((spec) => (
              <div
                key={spec.title}
                className="flex items-start gap-3.5 rounded-2xl bg-surface-subtle p-4"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand shadow-2xs">
                  <spec.icon className="size-5" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-ink">{spec.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{spec.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
