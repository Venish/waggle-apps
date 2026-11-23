import {
  Bell,
  ChevronRight,
  Dog,
  Settings,
  ShoppingBag,
  Target,
  Ticket,
  Video,
} from "lucide-react";
import { and, asc, dogs, eq, getDb, gt, isNull, or, sql, users, userTickets } from "@repo/db";
import { PointIcon } from "@repo/ui";
import { requireUserSession } from "@/00_lib/session";
import { getWalletSummary } from "@/04_services/shared/pointLedgerService";
import { DogAvatar } from "@/components/web/WebUiKit";
import { AppLink } from "@/components/web/ui";

export const dynamic = "force-dynamic";

export default async function MyPageHub() {
  const session = await requireUserSession();
  const db = getDb();

  const now = new Date();
  const [[user], myDogs, wallet, ticketCountRows] = await Promise.all([
    db.select().from(users).where(eq(users.id, session.userId)).limit(1),
    db
      .select()
      .from(dogs)
      .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
      .orderBy(asc(dogs.id)),
    getWalletSummary(session.userId),
    db
      .select({ cnt: sql<string>`COUNT(*)::text` })
      .from(userTickets)
      .where(
        and(
          eq(userTickets.userId, session.userId),
          eq(userTickets.status, "AVAILABLE"),
          eq(userTickets.isDeleted, false),
          or(isNull(userTickets.expiresAt), gt(userTickets.expiresAt, now)),
        ),
      ),
  ]);

  const primaryDog = myDogs.find((d) => d.isPrimary) ?? myDogs[0];
  const availableTicketCount = Number(ticketCountRows[0]?.cnt ?? 0);

  const menuLinks = [
    { href: "/app/my/dogs", icon: Dog, label: "내 반려견 관리", sub: `${myDogs.length}마리 등록 · 대표견 ${primaryDog?.name ?? "-"}` },
    { href: "/app/wallet", icon: PointIcon, label: "포인트 지갑 · 충전", sub: `보유 ${wallet.balance.toLocaleString("ko-KR")} P` },
    {
      href: "/app/my/tickets",
      icon: Ticket,
      label: "내 티켓 · 이용권",
      sub:
        availableTicketCount > 0
          ? `사용 가능 ${availableTicketCount}장 보유 중`
          : "프리미엄 코스 · 1:1 영상 문의권 보관함",
    },
    { href: "/app/inquiry", icon: Video, label: "훈련사 영상 Q&A", sub: "48시간 1:1 행동 상담" },
    { href: "/app/shop/orders", icon: ShoppingBag, label: "포인트샵 주문 · 배송", sub: "주문 내역 및 송장 조회" },
    { href: "/app/my/goal", icon: Target, label: "데일리 목표 · 리마인드", sub: "1일 목표 레슨 수 변경" },
    { href: "/app/my/notifications", icon: Bell, label: "알림함", sub: "학습·포인트·답변 알림" },
    { href: "/app/my/settings", icon: Settings, label: "계정 설정 · 보안", sub: "닉네임 · 푸시 · 비밀번호 · 로그아웃" },
  ];

  return (
    <div className="waggle-stagger space-y-6">
      <section className="flex items-center justify-between gap-3 pt-1">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight text-ink">
            {user?.nickname ?? session.nickname}님
          </h1>
          {user?.region && (
            <p className="mt-1 text-sm text-ink-muted">{user.region}</p>
          )}
        </div>
        {primaryDog && (
          <AppLink
            href="/app/my/dogs"
            aria-label={`${primaryDog.name} 프로필 관리`}
            className="shrink-0 rounded-full transition-transform duration-150 active:scale-[0.96]"
          >
            <DogAvatar src={primaryDog.profileImage} name={primaryDog.name} size="md" />
          </AppLink>
        )}
      </section>

      <div className="-mx-4 h-2 bg-surface-subtle" />

      <ul className="divide-y divide-border-subtle">
        {menuLinks.map((m) => (
          <li key={m.href}>
            <AppLink
              href={m.href}
              className="flex items-center justify-between gap-3 py-4 transition-opacity active:opacity-65"
            >
              <div className="flex min-w-0 items-center gap-3.5">
                <m.icon className="size-5 shrink-0 text-ink" strokeWidth={1.8} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{m.label}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">{m.sub}</p>
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-ink-muted" strokeWidth={1.8} />
            </AppLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
