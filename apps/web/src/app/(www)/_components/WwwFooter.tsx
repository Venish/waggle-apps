"use client";

import { WaggleWordmark } from "@repo/ui";
import { useWwwScroll } from "./WwwScrollProvider";

const SERVICE_LINKS = [
  { id: "about", label: "보호자 공감 체크" },
  { id: "features", label: "핵심 기능" },
  { id: "courses", label: "대표 커리큘럼" },
  { id: "faq", label: "자주 묻는 질문" },
] as const;

export function WwwFooter() {
  const { scrollTo } = useWwwScroll();

  return (
    <footer className="bg-[#0B0F17] text-neutral-300">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 md:grid-cols-12">
          {/* Brand Summary */}
          <div className="space-y-4 md:col-span-6">
            <button
              type="button"
              onClick={() => scrollTo(0)}
              aria-label="와글 상단으로 이동"
              className="inline-flex cursor-pointer items-center"
            >
              <WaggleWordmark className="h-8 w-auto text-white" />
            </button>
            <p className="max-w-sm text-sm leading-relaxed text-neutral-400">
              반려견 성향 설문 맞춤 교육부터 데일리·건강 기록, 포인트샵과 전문 훈련사 1:1
              영상 Q&amp;A까지 보호자와 강아지가 함께 성장하는 플랫폼입니다.
            </p>
            <p className="pt-2 text-xs text-neutral-500">
              © 2026 Waggle. All rights reserved.
            </p>
          </div>

          {/* Customer-only Service Index (Zero Admin / Server / Tech Stack Links) */}
          <div className="grid grid-cols-2 gap-8 md:col-span-6 md:justify-items-end">
            <div className="space-y-3">
              <p className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
                서비스 안내
              </p>
              <ul className="space-y-2.5 text-sm">
                {SERVICE_LINKS.map((link) => (
                  <li key={link.id}>
                    <button
                      type="button"
                      onClick={() => scrollTo(`#${link.id}`, -72)}
                      className="cursor-pointer text-neutral-300 transition-colors hover:text-white"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold tracking-wider text-neutral-400 uppercase">
                앱 시작하기
              </p>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollTo("#download", -72)}
                    className="cursor-pointer text-neutral-300 transition-colors hover:text-white"
                  >
                    iOS App Store
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollTo("#download", -72)}
                    className="cursor-pointer text-neutral-300 transition-colors hover:text-white"
                  >
                    Android Google Play
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
