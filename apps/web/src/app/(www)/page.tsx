import Link from "next/link";
import {
  Award,
  CalendarDays,
  CheckCircle2,
  Coins,
  Database,
  GraduationCap,
} from "lucide-react";
import { pingDatabase } from "@repo/db";
import { WaggleMark, WaggleWordmark } from "@repo/ui";
import { AppBadge, AppLinkButton } from "@/components/web/ui";

export const dynamic = "force-dynamic";

async function getDbStatus() {
  try {
    const info = await pingDatabase();
    return {
      ok: true as const,
      label: `PostgreSQL 18 (${info.database}) · ${info.latencyMs}ms`,
    };
  } catch (error) {
    return {
      ok: false as const,
      label: error instanceof Error ? error.message : "DB 연결 확인 필요",
    };
  }
}

export default async function WwwLandingPage() {
  const dbStatus = await getDbStatus();

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      {/* Top Navigation */}
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="와글 홈" className="flex items-center">
            <WaggleWordmark className="h-8 w-auto text-brand" />
          </Link>

          <div className="flex items-center gap-2">
            <AppLinkButton href="/admin" variant="secondary" size="sm">
              Admin 콘솔
            </AppLinkButton>
            <AppLinkButton href="/app" variant="primary" size="sm">
              앱 바로가기
            </AppLinkButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-20 px-4 py-14 sm:px-6 sm:py-20">
        {/* Hero Section (Editorial Flat + Single Waggle Green) */}
        <section className="grid items-center gap-10 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2">
              <AppBadge tone="brand" size="md">
                <WaggleMark className="size-3.5" />
                반려견 맞춤 교육 루틴
              </AppBadge>
              <AppBadge tone={dbStatus.ok ? "neutral" : "danger"} size="md" className="tabular-nums">
                <Database className="size-3.5" strokeWidth={2} />
                {dbStatus.label}
              </AppBadge>
            </div>

            <h1 className="text-display font-extrabold leading-[1.15] tracking-tight text-ink">
              매일 5분 맞춤 교육으로
              <br />
              우리 강아지가 달라져요
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-ink-muted">
              반려견 성향 설문 매칭부터 영상·실습·퀴즈 3단계 강의 루프, 포인트 적립과 포인트샵,
              훈련사 1:1 비동기 영상 Q&amp;A까지 하나의 웹앱에서 이어집니다.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <AppLinkButton href="/app" variant="primary" size="lg" className="px-6">
                와글 웹앱 시작하기
              </AppLinkButton>
              <AppLinkButton href="/admin" variant="secondary" size="lg" className="px-6">
                운영 콘솔 (/admin)
              </AppLinkButton>
            </div>
          </div>

          {/* 4-Pillar Feature Overview */}
          <div className="grid grid-cols-2 gap-3 lg:col-span-5">
            {[
              {
                icon: GraduationCap,
                title: "맞춤 커리큘럼",
                desc: "7문항 성향 설문 + 선택 레벨테스트",
              },
              {
                icon: Coins,
                title: "포인트 & 샵",
                desc: "ACID 원장 적립 · 간식·코스 교환",
              },
              {
                icon: CalendarDays,
                title: "데일리 & 접종",
                desc: "월간 산책 캘린더 · 예방접종 기록",
              },
              {
                icon: Award,
                title: "배지 & 학년",
                desc: "데일리 목표 달성 · 유치원~우등 5학년",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-3xl bg-surface-subtle p-5">
                <item.icon className="size-5 text-brand" strokeWidth={2} />
                <p className="mt-4 text-base font-bold tracking-tight text-ink">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Core 3-Step Loop */}
        <section className="space-y-6 border-t border-border-subtle pt-12">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">
              와글 핵심 3단계 교육 루프
            </h2>
            <p className="mt-1.5 text-sm text-ink-muted">
              단순 시청에 그치지 않고 자가 실습과 퀴즈로 학습 완주율을 높입니다.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                num: "01",
                title: "영상 시청 (95% 판정)",
                desc: "전문 훈련사의 핵심 교육 영상을 배속 지원 YouTube 플레이어로 집중 학습합니다.",
              },
              {
                num: "02",
                title: "실습 자가체크",
                desc: "우리 강아지와 직접 연습한 뒤 단계별 체크리스트로 실행 여부를 확인합니다.",
              },
              {
                num: "03",
                title: "퀴즈 통과 & 포인트 보상",
                desc: "4지선다 퀴즈 통과 시 즉시 포인트 원장에 적립되고 배지·학년이 갱신됩니다.",
              },
            ].map((step) => (
              <div key={step.num} className="rounded-3xl bg-surface-subtle p-6">
                <AppBadge tone="brand" className="tabular-nums">
                  STEP {step.num}
                </AppBadge>
                <h3 className="mt-4 text-base font-bold tracking-tight text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3-Domain Architecture Strip */}
        <section className="flex flex-col justify-between gap-4 border-t border-border-subtle pt-10 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-ink">3-Domain 물리 격리 아키텍처</h2>
            <p className="text-xs text-ink-muted">
              단일 Next.js 16 앱에서 (www) · (mobile) · (admin)이 독립 레이아웃과 전용 CSS로
              동작합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              "(www) Editorial Landing",
              "(mobile) 440px Fluid REM",
              "(admin) Atlas Precision Studio",
            ].map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-xl bg-surface-subtle px-3 py-1.5 text-xs font-medium text-ink"
              >
                <CheckCircle2 className="size-3.5 text-brand" strokeWidth={2} />
                {label}
              </span>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border-subtle bg-surface py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-3 px-4 text-xs text-ink-muted sm:flex-row sm:items-center sm:px-6">
          <p>Waggle — 반려견 맞춤 교육 · 데일리 기록 · 포인트샵</p>
          <p className="tabular-nums">Next.js 16.2.6 · Tailwind v4 · PostgreSQL 18</p>
        </div>
      </footer>
    </div>
  );
}
