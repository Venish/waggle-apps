"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowDownRight, Check, HeartHandshake } from "lucide-react";
import { WaggleMark } from "@repo/ui";
import { useWwwScroll } from "./WwwScrollProvider";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const EMPATHY_ITEMS = [
  {
    num: "01",
    tag: "산책 매너",
    title: "산책할 때마다 리드줄을 당기거나 다른 강아지에게 짖어 난감하다",
    desc: "매번 힘으로 제어하려다 보호자도 강아지도 지쳐가는 산책 시간을 바꾸고 싶어요.",
  },
  {
    num: "02",
    tag: "분리불안 · 짖음",
    title: "현관문 소리·외출 시 짖음과 분리불안 때문에 늘 마음이 쓰인다",
    desc: "이웃 눈치도 보이고, 혼자 남겨진 아이가 스트레스 받을까 봐 외출이 망설여져요.",
  },
  {
    num: "03",
    tag: "교육 순서",
    title: "유튜브 교육 영상을 봐도 우리 강아지에게 맞는 순서가 헷갈린다",
    desc: "정보는 넘치는데 막상 우리 아이의 나이와 성향에 딱 맞는 단계가 무엇인지 막막해요.",
  },
  {
    num: "04",
    tag: "꾸준한 루틴",
    title: "바쁜 일상 속에서 길게 훈련할 시간 없이 매일 5분 루틴이 필요하다",
    desc: "거창한 훈련보다 퇴근 후 5분씩 부담 없이 이어갈 수 있는 현실적인 가이드가 필요해요.",
  },
  {
    num: "05",
    tag: "건강 · 일상 기록",
    title: "예방접종 일정, 체중 변화, 산책 일기를 한눈에 모아두고 싶다",
    desc: "메모장과 앨범에 흩어져 있던 우리 강아지의 성장 기록을 깔끔하게 남기고 싶어요.",
  },
] as const;

const STICKY_TOP_OFFSETS = [
  "lg:top-24",
  "lg:top-28",
  "lg:top-32",
  "lg:top-36",
  "lg:top-40",
  "lg:top-44",
] as const;

export function WwwSelfCheckSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollTo } = useWwwScroll();

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Desktop: Stacking card scale-down depth as subsequent cards glide over
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const cards = gsap.utils.toArray<HTMLElement>("[data-stack-card]");
        cards.forEach((card, index) => {
          const nextCard = cards[index + 1];
          if (!nextCard) return;

          gsap.to(card, {
            scale: 0.96,
            opacity: 0.72,
            ease: "none",
            scrollTrigger: {
              trigger: nextCard,
              start: "top 78%",
              end: "top 24%",
              scrub: 0.4,
            },
          });
        });
      });

      // Mobile / Tablet: Clean entrance pop
      mm.add("(max-width: 1023px) and (prefers-reduced-motion: no-preference)", () => {
        const cards = gsap.utils.toArray<HTMLElement>("[data-stack-card]");
        cards.forEach((card) => {
          gsap.from(card, {
            y: 22,
            opacity: 0,
            duration: 0.55,
            ease: "power2.out",
            clearProps: "transform,opacity",
            scrollTrigger: {
              trigger: card,
              start: "top 88%",
              once: true,
            },
          });
        });
      });

      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  return (
    <section
      id="about"
      ref={sectionRef}
      className="relative border-t border-border-subtle py-20 sm:py-28 lg:py-32"
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8">
        {/* Left 5 Columns: Sticky Narrative Column */}
        <div className="lg:col-span-5">
          <div className="space-y-5 lg:sticky lg:top-28">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
              <HeartHandshake className="size-3.5" strokeWidth={2.2} />
              보호자 공감 체크
            </span>

            <h2 className="text-balance text-3xl font-extrabold leading-[1.2] tracking-tight text-ink sm:text-4xl">
              혹시 이런 고민,
              <br />
              매일 하고 계신가요?
            </h2>

            <p className="text-pretty text-base leading-relaxed text-ink-muted">
              단 하나라도 고개가 끄덕여진다면, 우리 강아지에게 필요한 건 더 많은 정보가 아니라
              <strong className="font-bold text-ink"> 매일 5분 따라 할 수 있는 정확한 순서</strong>
              입니다.
            </p>

            <div className="hidden pt-2 lg:block">
              <button
                type="button"
                onClick={() => scrollTo("#features", -72)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-surface-subtle px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-brand-soft hover:text-brand"
              >
                <span>와글이 해결하는 방법 보기</span>
                <ArrowDownRight className="size-4" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>

        {/* Right 7 Columns: Stacking Empathy Cards + 6th Solution Card */}
        <div className="space-y-4 lg:col-span-7 lg:space-y-6">
          {EMPATHY_ITEMS.map((item, idx) => (
            <article
              key={item.num}
              data-stack-card
              className={[
                "rounded-3xl border border-border-subtle bg-surface p-6 shadow-xs sm:p-7",
                "lg:sticky",
                STICKY_TOP_OFFSETS[idx],
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-subtle px-2.5 py-1 text-xs font-bold text-ink-muted">
                  <span className="tabular-nums text-brand">{item.num}</span>
                  <span>{item.tag}</span>
                </span>
                <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Check className="size-4" strokeWidth={2.5} />
                </span>
              </div>
              <h3 className="mt-4 text-lg font-extrabold leading-snug tracking-tight text-ink sm:text-xl">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.desc}</p>
            </article>
          ))}

          {/* 6th Highlight Solution Card */}
          <article
            data-stack-card
            className={[
              "rounded-3xl bg-brand p-7 text-on-brand shadow-lg sm:p-8",
              "lg:sticky",
              STICKY_TOP_OFFSETS[5],
            ].join(" ")}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-2xl bg-white/18">
                <WaggleMark className="size-5 text-on-brand" />
              </span>
              <span className="text-xs font-extrabold tracking-wide opacity-90">
                WAGGLE SOLUTION
              </span>
            </div>
            <h3 className="mt-4 text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">
              매일 5분, 우리 강아지 성향에 맞춘
              <br />
              가장 쉬운 교육 루틴을 시작하세요
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed opacity-90">
              7문항 성향 설문으로 맞춤 커리큘럼을 추천받고, 짧은 영상·실습 체크·퀴즈로 완주하며
              포인트와 성장 기록까지 차곡차곡 쌓아갑니다.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
