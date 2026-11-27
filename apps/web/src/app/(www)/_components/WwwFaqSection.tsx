"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import styles from "../landing.module.css";

const FAQ_ITEMS = [
  {
    q: "초보 보호자나 강아지 나이가 많아도 시작할 수 있나요?",
    a: "네, 처음 반려견을 맞이한 보호자부터 성견·노령견까지 모두 쉽게 따라 할 수 있도록 구성되어 있습니다. 가입 후 7문항 성향 설문을 완료하면 우리 강아지의 현재 단계에 맞는 커리큘럼을 자동으로 추천해 드립니다.",
  },
  {
    q: "무료로 이용할 수 있는 범위는 어디까지인가요?",
    a: "기본 생활 매너·산책 핵심 강좌, 월간 데일리 기록, 사진 갤러리, 체중 및 예방접종 기록은 무료로 이용하실 수 있습니다. 강좌 완주와 기록으로 적립한 포인트로 프리미엄 강좌나 포인트샵 상품을 교환하는 것도 가능합니다.",
  },
  {
    q: "하루에 얼마나 시간을 투자해야 하나요?",
    a: "하루 5분이면 충분합니다. 모든 강의가 짧은 핵심 영상 시청 → 우리 강아지와 바로 해보는 실습 체크 → 가벼운 퀴즈 3단계로 나뉘어 있어 바쁜 평일에도 부담 없이 루틴을 이어갈 수 있습니다.",
  },
  {
    q: "반려견이 여러 마리인데 각각 따로 관리할 수 있나요?",
    a: "물론입니다. 한 계정 안에 여러 마리의 반려견 프로필을 등록해두고 상단 프로필 전환 한 번으로 강아지별 맞춤 강좌 진도, 데일리 일기, 체중·예방접종 기록을 독립적으로 관리할 수 있습니다.",
  },
  {
    q: "훈련사 1:1 영상 Q&A는 어떻게 진행되나요?",
    a: "교육 중 막히거나 교정이 필요한 행동 영상을 앱에서 업로드해 질문하시면, 담당 전문 훈련사가 영상을 직접 분석해 48시간 이내에 우리 강아지에게 맞는 해결 가이드를 답변으로 보내드립니다.",
  },
] as const;

export function WwwFaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="relative border-t border-border-subtle py-20 sm:py-28 lg:py-32"
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8">
        <div className="space-y-4 lg:col-span-4">
          <div className="space-y-4 lg:sticky lg:top-28">
            <h2 className="text-balance text-3xl font-extrabold leading-[1.2] tracking-tight text-ink sm:text-4xl">
              자주 묻는 질문
            </h2>
            <p className="text-pretty text-sm leading-relaxed text-ink-muted">
              와글 시작 전 보호자분들이 가장 많이 궁금해하시는 내용을 모았습니다.
            </p>
          </div>
        </div>

        <div className="space-y-3 lg:col-span-8">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={item.q}
                className="rounded-3xl border border-border-subtle bg-surface transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="text-base font-bold leading-snug text-ink">{item.q}</span>
                  <span
                    className={[
                      "flex size-8 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-ink-muted transition-transform duration-200",
                      isOpen ? "rotate-180 bg-brand-soft text-brand" : "",
                    ].join(" ")}
                  >
                    <ChevronDown className="size-4" strokeWidth={2.4} />
                  </span>
                </button>

                <div className={styles.accordionContent} data-open={isOpen}>
                  <div className={styles.accordionInner}>
                    <p className="px-6 pb-5 text-sm leading-relaxed text-ink-muted">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
