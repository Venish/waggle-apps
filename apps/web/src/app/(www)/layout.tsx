import type { ReactNode } from "react";
import "@/styles/web.css";
import { pretendardFont } from "@/00_lib/fonts";
// [보류] 헤딩 NanumSquareRound 재적용 시 nanumSquareRoundFont 함께 import
import { buildWebMetadata, WEB_VIEWPORT } from "@/00_lib/webMetadata";

export const viewport = WEB_VIEWPORT;

export const metadata = buildWebMetadata({
  title: "와글(Waggle) — 반려견 맞춤 교육 & 데일리 기록",
  description:
    "우리 강아지에게 맞는 커리큘럼으로 매일 5분 교육하고 기록하는 반려견 맞춤 교육 플랫폼 와글",
  urlPath: "/",
});

export default function WwwRootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ko"
      // className={`${pretendardFont.variable} ${nanumSquareRoundFont.variable}`}
      className={pretendardFont.variable}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-canvas text-ink">{children}</body>
    </html>
  );
}
