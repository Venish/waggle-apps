import localFont from "next/font/local";

/**
 * 공식 Pretendard Variable 단일 가변 폰트 (100~900 전 굵기 · ~1.96MB · 1회 요청)
 * - (www) · (mobile) · (admin) 3개 영역 공통 본문 폰트
 * - next/font/local 자동 preload + 메트릭 폴백 보정으로 FOUT/CLS 최소화
 */
export const pretendardFont = localFont({
  src: "../../public/fonts/Pretendard/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920",
  variable: "--font-pretendard",
  preload: true,
});

/**
 * NanumSquareRound 디스플레이 헤딩 폰트 (Regular 400 · Bold 700 · ExtraBold 800)
 * - 사용자 영역((www) · (mobile))의 h1~h6 및 .font-display 전용
 */
export const nanumSquareRoundFont = localFont({
  src: [
    {
      path: "../../public/fonts/NanumSquareRound/NanumSquareRoundR.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/NanumSquareRound/NanumSquareRoundB.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/NanumSquareRound/NanumSquareRoundEB.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-nanum-round",
  preload: true,
});
