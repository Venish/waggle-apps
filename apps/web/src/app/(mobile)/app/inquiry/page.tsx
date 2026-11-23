import { Clock, MessageSquareText, Video } from "lucide-react";
import { and, asc, desc, dogs, eq, getDb, gt, inquiries, isNull, or, userTickets } from "@repo/db";
import { formatDateTimeDot } from "@/00_lib/formatDate";
import { requireUserSession } from "@/00_lib/session";
import { getWalletSummary } from "@/04_services/shared/pointLedgerService";
import {
  getPolicyNumber,
  getRechargePackagesPolicy,
} from "@/04_services/shared/policyService";
import { InquiryNewSheetButton } from "@/components/web/SheetTriggerButtons";
import { EmptyStateCard, SubPageBottomBar, SubPageHeader } from "@/components/web/WebUiKit";
import { AppBadge, AppLink, AppLinkButton } from "@/components/web/ui";

export const dynamic = "force-dynamic";

const INQUIRY_STATUS_LABEL: Record<string, string> = {
  PENDING: "접수 대기",
  ASSIGNED: "훈련사 배정",
  ANSWERED: "답변 완료",
  EXPIRED: "SLA 만료·환불",
  CANCELLED: "취소·환불",
};

export default async function InquiryListPage() {
  const session = await requireUserSession();
  const db = getDb();

  const now = new Date();
  const [list, myDogs, inquiryPrice, wallet, rechargePackages, ticketRows] = await Promise.all([
    db
      .select()
      .from(inquiries)
      .where(and(eq(inquiries.userId, session.userId), eq(inquiries.isDeleted, false)))
      .orderBy(desc(inquiries.id)),
    db
      .select({ id: dogs.id, name: dogs.name })
      .from(dogs)
      .where(and(eq(dogs.userId, session.userId), eq(dogs.isDeleted, false)))
      .orderBy(asc(dogs.id)),
    getPolicyNumber("inquiry.price"),
    getWalletSummary(session.userId),
    getRechargePackagesPolicy(),
    db
      .select({ id: userTickets.id, titleSnap: userTickets.titleSnap })
      .from(userTickets)
      .where(
        and(
          eq(userTickets.userId, session.userId),
          eq(userTickets.ticketType, "INQUIRY_TICKET"),
          eq(userTickets.status, "AVAILABLE"),
          eq(userTickets.isDeleted, false),
          or(isNull(userTickets.expiresAt), gt(userTickets.expiresAt, now)),
        ),
      )
      .orderBy(asc(userTickets.id)),
  ]);

  return (
    <>
      <div className="flex flex-1 flex-col space-y-5 pb-24">
        <SubPageHeader title="훈련사 영상 Q&A" backHref="/app/my" />

      <p className="rounded-2xl bg-surface-subtle px-4 py-3 text-xs leading-relaxed text-ink-muted">
        전문 훈련사가 48시간 이내에 맞춤 솔루션을 답변합니다. SLA 초과 시 차감 포인트가 전액 자동
        환불됩니다.
      </p>

      {list.length === 0 ? (
        <EmptyStateCard
          icon={<MessageSquareText className="size-5.5" strokeWidth={1.7} />}
          title="아직 작성한 Q&A가 없어요"
          description="우리 강아지의 행동 영상과 질문을 올려 훈련사님께 조언을 받아보세요."
          ctaLabel="첫 영상 Q&A 작성"
          ctaHref="/app/inquiry/new"
        />
      ) : (
        <ul className="divide-y divide-border-subtle border-y border-border-subtle">
          {list.map((item) => {
            const isAnswered = item.status === "ANSWERED";
            const isClosed = item.status === "EXPIRED" || item.status === "CANCELLED";
            return (
              <li key={item.id}>
                <AppLink
                  href={`/app/inquiry/${item.id}`}
                  className="block py-4 transition-opacity active:opacity-65"
                >
                  <div className="flex items-center justify-between gap-2">
                    <AppBadge tone={isAnswered ? "brand" : isClosed ? "neutral" : "ink"}>
                      {INQUIRY_STATUS_LABEL[item.status] ?? item.status}
                    </AppBadge>
                    <span className="flex items-center gap-1 text-xs tabular-nums text-ink-muted">
                      <Clock className="size-3.5" />
                      SLA {formatDateTimeDot(item.slaDueAt)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-ink">
                    {item.question}
                  </p>
                  {item.videoUrl && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-ink-muted">
                      <Video className="size-3.5" /> 첨부 파일 포함
                    </p>
                  )}
                </AppLink>
              </li>
            );
          })}
          </ul>
        )}
      </div>

      <SubPageBottomBar>
        {myDogs.length > 0 ? (
          <InquiryNewSheetButton
            dogs={myDogs}
            inquiryPrice={inquiryPrice}
            walletBalance={wallet.balance}
            availableTickets={ticketRows.map((t) => ({ id: t.id, title: t.titleSnap }))}
            rechargePackages={rechargePackages}
            label="질문 작성하기"
            size="lg"
            fullWidth
          />
        ) : (
          <AppLinkButton href="/app/inquiry/new" variant="primary" size="lg" fullWidth>
            질문 작성하기
          </AppLinkButton>
        )}
      </SubPageBottomBar>
    </>
  );
}
