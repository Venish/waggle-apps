import { requireUserSession } from "@/00_lib/session";
import { getWalletSummary } from "@/04_services/shared/pointLedgerService";
import { getRechargePackagesPolicy } from "@/04_services/shared/policyService";
import { RechargeClient } from "@/components/web/RechargeClient";
import { SubPageHeader } from "@/components/web/WebUiKit";

export const dynamic = "force-dynamic";

export default async function WalletRechargePage() {
  const session = await requireUserSession();
  const [packages, summary] = await Promise.all([
    getRechargePackagesPolicy(),
    getWalletSummary(session.userId),
  ]);

  return (
    <div className="space-y-4">
      <SubPageHeader title="포인트 충전" backHref="/app/wallet" />
      <RechargeClient packages={packages} walletBalance={summary.balance} />
    </div>
  );
}
