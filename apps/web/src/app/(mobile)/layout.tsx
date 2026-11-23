import type { ReactNode } from "react";
import { and, count, eq, getDb, notifications } from "@repo/db";
import "@/styles/web.css";
import { pretendardFont } from "@/00_lib/fonts";
// [보류] 헤딩 NanumSquareRound 재적용 시 nanumSquareRoundFont 함께 import
import { getCurrentUserSession } from "@/00_lib/session";
import { buildWebMetadata, WEB_VIEWPORT } from "@/00_lib/webMetadata";
import { getWalletSummary } from "@/04_services/shared/pointLedgerService";
import { BottomNavBar } from "@/components/web/BottomNavBar";
import { GlobalOverlayProvider } from "@/components/web/GlobalOverlayProvider";
import { MobileShellMain } from "@/components/web/MobileShellMain";
import { MobileTopHeader } from "@/components/web/MobileTopHeader";
import { MobileViewTransitionShell } from "@/components/web/MobileViewTransitionShell";
import { WebGlobalAlert } from "@/components/web/WebGlobalAlert";

export const viewport = WEB_VIEWPORT;

export const metadata = buildWebMetadata({
  title: "와글 앱 — 반려견 맞춤 교육",
  description:
    "성향 설문 매칭부터 3단계 레슨·데일리 기록·포인트샵·훈련사 영상 Q&A까지 와글 모바일 웹앱",
  urlPath: "/app",
});

export const dynamic = "force-dynamic";

export default async function MobileRootLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentUserSession();
  let pointBalance = 0;
  let unreadCount = 0;

  if (session) {
    const db = getDb();
    const [wallet, unreadRows] = await Promise.all([
      getWalletSummary(session.userId),
      db
        .select({ total: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, session.userId), eq(notifications.isRead, false))),
    ]);
    pointBalance = wallet.balance;
    unreadCount = unreadRows[0]?.total ?? 0;
  }

  return (
    <html
      lang="ko"
      // className={`${pretendardFont.variable} ${nanumSquareRoundFont.variable}`}
      className={pretendardFont.variable}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-canvas text-ink sm:h-dvh sm:overflow-hidden sm:bg-ink/[0.06]">
        <div
          data-waggle-app="true"
          className="waggle-app-shell relative mx-auto flex min-h-dvh w-full max-w-app flex-col overflow-x-clip bg-canvas sm:h-dvh sm:min-h-0 sm:overflow-x-hidden sm:overflow-y-auto sm:overscroll-y-contain sm:shadow-2xl sm:ring-1 sm:ring-ink/[0.08]"
        >
          <MobileViewTransitionShell>
            {/* Sticky Top Header (온보딩 화면에서는 심플 헤더로 자동 전환) */}
            <MobileTopHeader
              isAuthenticated={Boolean(session)}
              pointBalance={pointBalance}
              unreadCount={unreadCount}
            />

            {/* Main Scrollable Content (라우트별 여백·전환 모션 자동 분기) */}
            <MobileShellMain>{children}</MobileShellMain>

            {/* Floating Liquid Glass 5-Tab Bottom Navigation Bar (A안) */}
            <BottomNavBar />
          </MobileViewTransitionShell>

          {/* 0ms Native Overlay Sheet Stack & Global Alert */}
          <GlobalOverlayProvider />
          <WebGlobalAlert />
        </div>
      </body>
    </html>
  );
}
