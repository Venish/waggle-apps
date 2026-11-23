import { and, asc, dogs, eq, getDb, gt, isNull, or, userTickets } from "@repo/db";
import { requireUserSession } from "@/00_lib/session";
import { getWalletSummary } from "@/04_services/shared/pointLedgerService";
import {
  getPolicyNumber,
  getRechargePackagesPolicy,
} from "@/04_services/shared/policyService";
import { NewInquiryFormClient } from "@/components/web/NewInquiryFormClient";
import { EmptyStateCard, SubPageHeader } from "@/components/web/WebUiKit";

export const dynamic = "force-dynamic";

export default async function InquiryNewPage() {
  const session = await requireUserSession();
  const db = getDb();
  const now = new Date();

  const [myDogs, price, wallet, rechargePackages, ticketRows] = await Promise.all([
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
    <div className="flex flex-1 flex-col space-y-4">
      <SubPageHeader title="영상 Q&A 작성" backHref="/app/inquiry" />
      {myDogs.length > 0 ? (
        <NewInquiryFormClient
          dogs={myDogs}
          inquiryPrice={price}
          walletBalance={wallet.balance}
          availableTickets={ticketRows.map((t) => ({ id: t.id, title: t.titleSnap }))}
          rechargePackages={rechargePackages}
        />
      ) : (
        <EmptyStateCard
          title="먼저 반려견을 등록해 주세요"
          description="반려견 프로필이 있어야 영상 Q&A를 접수할 수 있습니다."
          ctaLabel="반려견 등록"
          ctaHref="/app/onboarding/profile"
        />
      )}
    </div>
  );
}
