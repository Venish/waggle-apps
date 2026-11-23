import type { CSSProperties } from "react";

const PAW_STEPS = [
  { tx: 36, ty: 334, rot: 56, sc: 0.92, op: 0.19, delay: "120ms" },
  { tx: 96, ty: 318, rot: 58, sc: 0.9, op: 0.17, delay: "300ms" },
  { tx: 142, ty: 268, rot: 52, sc: 0.88, op: 0.15, delay: "480ms" },
  { tx: 204, ty: 250, rot: 55, sc: 0.86, op: 0.13, delay: "660ms" },
  { tx: 254, ty: 202, rot: 54, sc: 0.84, op: 0.11, delay: "840ms" },
  { tx: 316, ty: 184, rot: 58, sc: 0.82, op: 0.09, delay: "1020ms" },
  { tx: 362, ty: 138, rot: 60, sc: 0.8, op: 0.07, delay: "1200ms" },
] as const;

/**
 * 로그인·온보딩 공용 하단 민트 그라데이션 + 강아지 발자국 "총총" 순차 스탬프 배경
 * - 기록(/app/record)과 동일한 .waggle-record-bg 톤에 순수 CSS 스탬프 모션 결합
 */
export function PawTrailBackdrop({ animated = true }: { animated?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="waggle-record-bg pointer-events-none fixed inset-x-0 bottom-0 z-0 mx-auto h-[26rem] w-full max-w-app overflow-hidden"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 390 380"
        preserveAspectRatio="xMidYMax slice"
        className="size-full text-brand"
      >
        <defs>
          <g id="waggle-auth-trail-paw" fill="currentColor">
            <ellipse cx="-10" cy="-5" rx="3.5" ry="4" />
            <ellipse cx="-4" cy="-11.5" rx="3.5" ry="4.5" />
            <ellipse cx="4" cy="-11.5" rx="3.5" ry="4.5" />
            <ellipse cx="10" cy="-5" rx="3.5" ry="4" />
            <ellipse cx="0" cy="1" rx="6" ry="7" />
            <circle cx="-5" cy="5" r="5" />
            <circle cx="5" cy="5" r="5" />
          </g>
        </defs>
        {PAW_STEPS.map((p, idx) => (
          <g key={idx} transform={`translate(${p.tx} ${p.ty}) rotate(${p.rot}) scale(${p.sc})`}>
            <use
              href="#waggle-auth-trail-paw"
              className={animated ? "waggle-paw-step" : undefined}
              opacity={animated ? undefined : p.op}
              style={
                animated
                  ? ({
                      "--paw-op": String(p.op),
                      "--paw-delay": p.delay,
                    } as CSSProperties)
                  : undefined
              }
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

/** 카카오 공식 말풍선 심볼 */
export function KakaoSymbol({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 3C6.477 3 2 6.463 2 10.734c0 2.758 1.829 5.177 4.585 6.54-.152.536-.977 3.455-1.009 3.686 0 0-.02.167.088.232.108.065.235.015.235.015.31-.043 3.595-2.345 4.16-2.747.624.092 1.272.14 1.941.14 5.523 0 10-3.463 10-7.866C22 6.463 17.523 3 12 3z" />
    </svg>
  );
}

/** Apple 공식 로고 심볼 */
export function AppleSymbol({ className = "size-5.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M16.365 12.695c-.022-2.208 1.805-3.274 1.887-3.326-1.031-1.508-2.634-1.714-3.203-1.737-1.36-.138-2.66.803-3.35.803-.692 0-1.758-.784-2.893-.762-1.486.022-2.858.867-3.621 2.198-1.547 2.681-.395 6.648 1.108 8.821.736 1.064 1.612 2.258 2.762 2.216 1.11-.044 1.53-.716 2.871-.716 1.341 0 1.72.716 2.89.693 1.194-.022 1.948-1.084 2.677-2.151.847-1.236 1.195-2.435 1.215-2.498-.027-.012-2.323-.892-2.343-3.541zM14.17 6.2c.611-.741 1.023-1.77.911-2.796-.881.036-1.95.588-2.581 1.326-.565.654-1.062 1.703-.929 2.708.984.076 1.988-.498 2.599-1.238z" />
    </svg>
  );
}

/**
 * 원형 카카오 · Apple 로고 단독 버튼 2종 (공식 브랜드 컬러 & 로고 전용 가이드 준수)
 */
export function SocialAuthIconRow({ mode }: { mode: "login" | "signup" }) {
  const suffix = mode === "login" ? "로그인" : "회원가입";
  return (
    <div className="flex items-center justify-center gap-4">
      <a
        href="/api/auth/callback/kakao"
        aria-label={`카카오 ${suffix}`}
        title={`카카오 ${suffix}`}
        className="flex size-13 items-center justify-center rounded-full bg-[#FEE500] text-[#191919] shadow-xs transition-transform duration-150 hover:brightness-97 active:scale-95"
      >
        <KakaoSymbol className="size-6" />
      </a>
      <a
        href="/api/auth/callback/apple"
        aria-label={`Apple ${suffix}`}
        title={`Apple ${suffix}`}
        className="flex size-13 items-center justify-center rounded-full bg-ink text-surface shadow-xs transition-transform duration-150 hover:opacity-90 active:scale-95"
      >
        <AppleSymbol className="size-5.5 -translate-y-0.5" />
      </a>
    </div>
  );
}
