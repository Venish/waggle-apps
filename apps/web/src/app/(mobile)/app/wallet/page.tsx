import { and, desc, eq, getDb, pointLedgers, pointRecharges } from "@repo/db";
import { PointIcon } from "@repo/ui";
import { formatDateDot, formatDateTimeDot } from "@/00_lib/formatDate";
import { requireUserSession } from "@/00_lib/session";
import { computeRechargeRefundMeta } from "@/04_services/shared/commerceRefundService";
import { getWalletSummary } from "@/04_services/shared/pointLedgerService";
import { getRechargePackagesPolicy } from "@/04_services/shared/policyService";
import { WalletRechargeSheetButton } from "@/components/web/SheetTriggerButtons";
import {
  WalletTabsClient,
  type WalletLedgerItemView,
  type WalletRechargeItemView,
} from "@/components/web/WalletTabsClient";
import { SubPageHeader } from "@/components/web/WebUiKit";
import { AppLinkButton } from "@/components/web/ui";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const session = await requireUserSession();
  const db = getDb();

  const [summary, ledgers, recharges, rechargeLedgers, packages] = await Promise.all([
    getWalletSummary(session.userId),
    db
      .select()
      .from(pointLedgers)
      .where(eq(pointLedgers.userId, session.userId))
      .orderBy(desc(pointLedgers.id))
      .limit(30),
    db
      .select()
      .from(pointRecharges)
      .where(and(eq(pointRecharges.userId, session.userId), eq(pointRecharges.isDeleted, false)))
      .orderBy(desc(pointRecharges.id))
      .limit(30),
    db
      .select({
        refId: pointLedgers.refId,
        remainingAmount: pointLedgers.remainingAmount,
      })
      .from(pointLedgers)
      .where(
        and(
          eq(pointLedgers.userId, session.userId),
          eq(pointLedgers.reason, "EARN_RECHARGE"),
          eq(pointLedgers.refType, "recharge"),
        ),
      ),
    getRechargePackagesPolicy(),
  ]);

  const remainingByRechargeId = new Map<number, number>();
  for (const rl of rechargeLedgers) {
    if (rl.refId !== null) {
      remainingByRechargeId.set(rl.refId, rl.remainingAmount ?? 0);
    }
  }

  const ledgerViews: WalletLedgerItemView[] = ledgers.map((row) => ({
    id: row.id,
    title: row.memo ?? row.reason,
    createdAtText: formatDateTimeDot(row.createdAt),
    balanceAfter: row.balanceAfter,
    delta: row.delta,
  }));

  const rechargeViews: WalletRechargeItemView[] = recharges.map((rec) => {
    const remainingAmount = remainingByRechargeId.get(rec.id) ?? 0;
    const meta = computeRechargeRefundMeta({
      status: rec.status,
      channel: rec.channel,
      pointAmount: rec.pointAmount,
      paidAmount: rec.paidAmount,
      paidAt: rec.paidAt ?? rec.createdAt,
      remainingAmount,
      walletBalance: summary.balance,
    });

    return {
      id: rec.id,
      packageCode: rec.packageCode,
      channel: rec.channel,
      pointAmount: rec.pointAmount,
      paidAmount: rec.paidAmount,
      status: rec.status,
      paidAtText: formatDateTimeDot(rec.paidAt ?? rec.createdAt),
      refundedAtText: rec.refundedAt ? formatDateDot(rec.refundedAt) : null,
      refundReason: rec.refundReason,
      refundedPointAmount: rec.refundedPointAmount,
      refundedCashAmount: rec.refundedCashAmount,
      adminRejectReason: rec.adminRejectReason,
      usedPoints: meta.usedPoints,
      remainingPoints: meta.remainingPoints,
      refundablePoints: meta.refundablePoints,
      refundableCash: meta.refundableCash,
      actionMode: meta.actionMode,
    };
  });

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <SubPageHeader title="포인트 지갑" backHref="/app/my" />

      <section className="space-y-4 rounded-3xl bg-surface-subtle p-5">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
            <PointIcon className="size-4 text-brand" />
            보유 포인트
          </p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-ink">
            {summary.balance.toLocaleString("ko-KR")} P
          </p>
          <p className="mt-1 text-xs font-medium tabular-nums text-ink-muted">
            30일 이내 소멸 예정:{" "}
            <strong className="font-semibold text-ink">
              {summary.expiringIn30Days.toLocaleString("ko-KR")} P
            </strong>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <WalletRechargeSheetButton packages={packages} walletBalance={summary.balance} />
          <AppLinkButton
            href="/app/shop"
            variant="secondary"
            size="md"
            className="bg-surface hover:bg-surface/80"
          >
            포인트샵 가기
          </AppLinkButton>
        </div>
      </section>

      <WalletTabsClient ledgers={ledgerViews} recharges={rechargeViews} />
    </div>
  );
}
