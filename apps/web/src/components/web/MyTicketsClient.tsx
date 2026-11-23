"use client";

import { useMemo, useState } from "react";
import { Ticket } from "lucide-react";
import { TicketCard, type UserTicketView } from "@/components/web/TicketCard";
import { EmptyStateCard } from "@/components/web/WebUiKit";
import { AppSegmented } from "@/components/web/ui";

type TicketTab = "available" | "history";

export function MyTicketsClient({ tickets }: { tickets: UserTicketView[] }) {
  const [activeTab, setActiveTab] = useState<TicketTab>("available");

  const availableTickets = useMemo(
    () => tickets.filter((t) => t.effectiveStatus === "AVAILABLE"),
    [tickets],
  );
  const historyTickets = useMemo(
    () => tickets.filter((t) => t.effectiveStatus !== "AVAILABLE"),
    [tickets],
  );

  const visibleTickets = activeTab === "available" ? availableTickets : historyTickets;

  return (
    <div className="flex flex-1 flex-col space-y-4">
      <AppSegmented<TicketTab>
        asTabs
        ariaLabel="티켓 상태 분류"
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: "available", label: "사용 가능", count: availableTickets.length },
          { value: "history", label: "사용 완료 · 만료", count: historyTickets.length },
        ]}
      />

      {visibleTickets.length === 0 ? (
        <EmptyStateCard
          mode="page"
          icon={<Ticket className="size-5.5" strokeWidth={1.7} />}
          title={
            activeTab === "available"
              ? "사용 가능한 티켓이 없어요"
              : "사용 완료되거나 만료된 티켓이 없어요"
          }
          description={
            activeTab === "available"
              ? "포인트샵에서 프리미엄 강좌 티켓이나 1:1 영상 문의권을 구매하면 이곳에 보관됩니다."
              : "교육이나 Q&A에서 티켓을 사용하면 멍멍이 발 도장이 찍혀 이력에 남아요."
          }
          ctaLabel={activeTab === "available" ? "포인트샵 둘러보기" : undefined}
          ctaHref={activeTab === "available" ? "/app/shop" : undefined}
        />
      ) : (
        <ul className="space-y-3.5">
          {visibleTickets.map((ticket) => (
            <li key={ticket.id}>
              <TicketCard ticket={ticket} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
