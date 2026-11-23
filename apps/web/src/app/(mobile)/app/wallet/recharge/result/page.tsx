import { CheckCircle2, XCircle } from "lucide-react";
import { AppLinkButton } from "@/components/web/ui";

export default async function WalletRechargeResultPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; points?: string; paid?: string }>;
}) {
  const { status = "success", points = "0", paid = "0" } = await searchParams;
  const isSuccess = status === "success";

  return (
    <div className="space-y-8 py-10">
      <div className="text-center">
        {isSuccess ? (
          <CheckCircle2 className="mx-auto size-12 text-brand" strokeWidth={1.9} />
        ) : (
          <XCircle className="mx-auto size-12 text-destructive" strokeWidth={1.9} />
        )}
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">
          {isSuccess ? "포인트 충전 완료" : "결제가 취소되었습니다"}
        </h1>
        <p className="mt-2 text-xl font-extrabold tabular-nums text-brand-strong">
          +{Number(points).toLocaleString("ko-KR")} P
        </p>
        <p className="mt-1.5 text-xs tabular-nums text-ink-muted">
          결제 금액: {Number(paid).toLocaleString("ko-KR")}원 · 원장 반영 완료
        </p>
      </div>

      <div className="space-y-2.5">
        <AppLinkButton href="/app/wallet" variant="primary" size="lg" fullWidth>
          포인트 지갑 확인하기
        </AppLinkButton>
        <AppLinkButton href="/app/shop" variant="secondary" size="lg" fullWidth>
          포인트샵 둘러보기
        </AppLinkButton>
      </div>
    </div>
  );
}
