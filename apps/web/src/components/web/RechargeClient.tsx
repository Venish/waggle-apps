"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getMobileForwardTransitionTypes } from "@/00_lib/mobileRoutePresentation";
import { createClientRequestKey, useSubmitLock } from "@/02_hooks/useSubmitLock";
import { createPointRechargeAction } from "@/03_actions/web/walletShopActions";
import { useModalStore } from "@/01_store/web/useModalStore";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import type { RechargePackagePolicy } from "@/04_services/shared/policyService";
import { AppButton, AppChoiceCard } from "@/components/web/ui";

export function RechargeClient({
  packages,
  walletBalance,
  requiredShortfall,
  onCompleted,
  onBalanceSync,
}: {
  packages: RechargePackagePolicy[];
  walletBalance?: number;
  requiredShortfall?: number;
  onCompleted?: (result: { pointAmount: number; paidAmount: number }) => void;
  onBalanceSync?: (latestBalance: number) => void;
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const dismissForNavigation = useModalStore((s) => s.dismissForNavigation);

  const recommendedCode = (() => {
    if (!packages.length) return "";
    if (!requiredShortfall || requiredShortfall <= 0) return packages[0]!.code;
    const sorted = [...packages].sort((a, b) => a.pointAmount - b.pointAmount);
    const match = sorted.find((p) => p.pointAmount >= requiredShortfall);
    return (match ?? sorted[sorted.length - 1]!).code;
  })();

  const [selectedCode, setSelectedCode] = useState(recommendedCode);
  const { pending, run } = useSubmitLock();
  const requestKeyRef = useRef<string>(createClientRequestKey("rch"));

  // 패키지나 서버 잔액이 갱신되면 새 멱등키 발급
  useEffect(() => {
    requestKeyRef.current = createClientRequestKey("rch");
  }, [selectedCode, walletBalance]);

  const handlePayTest = () => {
    if (!selectedCode) return;
    void run(async () => {
      const res = await createPointRechargeAction({
        packageCode: selectedCode,
        channel: "WEB_PG",
        idempotencyKey: requestKeyRef.current,
        expectedWalletBalance: walletBalance,
      });
      if (!res.ok) {
        if (res.error.code === "BALANCE_STALE") {
          if (typeof res.error.latestBalance === "number") {
            onBalanceSync?.(res.error.latestBalance);
          }
          requestKeyRef.current = createClientRequestKey("rch");
          router.refresh();
        }
        openAlert({
          title: res.error.code === "BALANCE_STALE" ? "보유 포인트 변경 안내" : "충전 생성 실패",
          description: res.error.message,
          tone: "destructive",
        });
        return;
      }

      if (!res.data.alreadyPaid) {
        const webhookRes = await fetch("/api/webhooks/portone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: `evt_pay_${res.data.rechargeId}`,
            eventType: "Transaction.Paid",
            paymentId: res.data.paymentId,
            rechargeId: res.data.rechargeId,
            paidAmount: res.data.paidAmount,
          }),
        });
        const webhookJson = (await webhookRes.json()) as { ok: boolean; error?: string };
        if (!webhookRes.ok || !webhookJson.ok) {
          openAlert({
            title: "결제 웹훅 정산 실패",
            description: webhookJson.error ?? "정산 중 오류가 발생했습니다.",
            tone: "destructive",
          });
          return;
        }
      }

      if (onCompleted) {
        onCompleted({ pointAmount: res.data.pointAmount, paidAmount: res.data.paidAmount });
        router.refresh();
        return;
      }

      const resultUrl = `/app/wallet/recharge/result?status=success&points=${res.data.pointAmount}&paid=${res.data.paidAmount}`;
      const transitionTypes = getMobileForwardTransitionTypes(resultUrl);
      if (dismissForNavigation()) {
        router.replace(resultUrl, { transitionTypes });
      } else {
        router.push(resultUrl, { transitionTypes });
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      {requiredShortfall !== undefined && requiredShortfall > 0 && (
        <div className="rounded-2xl bg-brand-soft/65 px-4 py-3 text-xs leading-relaxed text-ink">
          현재{" "}
          <strong className="font-extrabold tabular-nums text-brand-strong">
            {requiredShortfall.toLocaleString("ko-KR")}P
          </strong>
          가 부족해요. 부족분을 채우는 최소 패키지를 미리 선택해 두었습니다.
        </div>
      )}

      <div className="space-y-2.5" role="radiogroup" aria-label="충전 패키지 선택">
        {packages.map((pkg) => (
          <AppChoiceCard
            key={pkg.code}
            selected={pkg.code === selectedCode}
            onClick={() => setSelectedCode(pkg.code)}
            title={pkg.label}
            description={
              <span className="tabular-nums">
                적립 {pkg.pointAmount.toLocaleString("ko-KR")} P
              </span>
            }
            right={
              <span className="text-base font-extrabold tabular-nums text-ink">
                {pkg.webPrice.toLocaleString("ko-KR")}원
              </span>
            }
          />
        ))}
      </div>

      <div className="rounded-2xl bg-surface-subtle px-4 py-3.5 text-xs leading-relaxed text-ink-muted">
        • 결제 완료 즉시 포인트 지갑에 적립됩니다.
        <br />• 미사용 충전분은 결제 후 7일 이내 전액 취소가 가능합니다.
      </div>

      <AppButton
        variant="primary"
        size="lg"
        fullWidth
        loading={pending}
        disabled={!selectedCode || pending}
        onClick={handlePayTest}
      >
        {pending ? "정산 처리 중..." : "포인트 결제하기"}
      </AppButton>
    </div>
  );
}
