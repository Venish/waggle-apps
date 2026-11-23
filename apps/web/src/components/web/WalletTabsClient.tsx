"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";
import { PointIcon } from "@repo/ui";
import { useSubmitLock } from "@/02_hooks/useSubmitLock";
import {
  cancelMyRechargeAction,
  requestRechargeRefundAction,
  withdrawRechargeRefundAction,
} from "@/03_actions/web/walletShopActions";
import type { RechargeRefundActionMode } from "@/04_services/shared/commerceRefundService";
import { useModalStore } from "@/01_store/web/useModalStore";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { EmptyStateCard } from "@/components/web/WebUiKit";
import {
  AppBadge,
  AppButton,
  AppChip,
  AppSegmented,
  AppTextarea,
  type AppBadgeTone,
} from "@/components/web/ui";

export interface WalletLedgerItemView {
  id: number;
  title: string;
  createdAtText: string;
  balanceAfter: number;
  delta: number;
}

export interface WalletRechargeItemView {
  id: number;
  packageCode: string | null;
  channel: "WEB_PG" | "IOS_IAP" | "ANDROID_IAP";
  pointAmount: number;
  paidAmount: number;
  status: string;
  paidAtText: string;
  refundedAtText: string | null;
  refundReason: string | null;
  refundedPointAmount: number | null;
  refundedCashAmount: number | null;
  adminRejectReason: string | null;
  usedPoints: number;
  remainingPoints: number;
  refundablePoints: number;
  refundableCash: number;
  actionMode: RechargeRefundActionMode;
}

const CHANNEL_LABEL: Record<WalletRechargeItemView["channel"], string> = {
  WEB_PG: "웹 결제",
  IOS_IAP: "App Store",
  ANDROID_IAP: "Google Play",
};

const RECHARGE_STATUS_META: Record<string, { label: string; tone: AppBadgeTone }> = {
  PENDING: { label: "결제 대기", tone: "neutral" },
  PAID: { label: "결제 완료", tone: "brand" },
  REFUND_REQUESTED: { label: "환불 요청 중", tone: "danger" },
  REFUNDED: { label: "환불 완료", tone: "neutral" },
  CANCELLED: { label: "취소됨", tone: "neutral" },
  FAILED: { label: "결제 실패", tone: "danger" },
};

const REFUND_PRESETS = ["단순 변심", "잔여 포인트 환불 요청", "잘못 충전함"] as const;

function RechargeRefundSheetForm({
  item,
  onDone,
}: {
  item: WalletRechargeItemView;
  onDone: () => void;
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const [reason, setReason] = useState<string>(REFUND_PRESETS[0]);
  const { pending, run } = useSubmitLock();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await requestRechargeRefundAction({ rechargeId: item.id, reason });
      if (!res.ok) {
        openAlert({ title: "환불 신청 실패", description: res.error.message, tone: "destructive" });
        return;
      }
      onDone();
      router.refresh();
      openAlert({
        title: "환불 신청이 접수되었습니다",
        description: "운영팀이 잔여 충전 포인트를 확인한 뒤 환불 처리해 드립니다.",
      });
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5 rounded-2xl bg-surface-subtle px-4 py-3.5 text-xs">
        <div className="flex items-center justify-between text-ink-muted">
          <span>환불 대상 잔여 포인트</span>
          <strong className="font-bold tabular-nums text-ink">
            {item.refundablePoints.toLocaleString("ko-KR")} P
          </strong>
        </div>
        <div className="flex items-center justify-between text-ink-muted">
          <span>예상 환불 금액 (원가 비례)</span>
          <strong className="font-bold tabular-nums text-brand-strong">
            {item.refundableCash.toLocaleString("ko-KR")}원
          </strong>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-ink-muted">환불 사유 선택</p>
        <div className="flex flex-wrap gap-1.5">
          {REFUND_PRESETS.map((p) => (
            <AppChip key={p} selected={reason === p} onClick={() => setReason(p)}>
              {p}
            </AppChip>
          ))}
        </div>
      </div>

      <AppTextarea
        id="recharge-refund-reason"
        label="상세 사유 *"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="환불 사유를 입력해 주세요"
      />

      <p className="text-xs leading-relaxed text-ink-muted">
        • 무상 적립 포인트는 환불 대상이 아니며, 관리자 승인 시 잔여 충전 포인트가 회수됩니다.
      </p>

      <AppButton type="submit" variant="primary" size="lg" fullWidth loading={pending}>
        {pending ? "신청 중..." : "환불 신청 접수"}
      </AppButton>
    </form>
  );
}

export function WalletTabsClient({
  ledgers,
  recharges,
}: {
  ledgers: WalletLedgerItemView[];
  recharges: WalletRechargeItemView[];
}) {
  const router = useRouter();
  const openModal = useModalStore((s) => s.openModal);
  const closeTopModal = useModalStore((s) => s.closeTopModal);
  const openAlert = useWebAlertStore((s) => s.openAlert);

  const [tab, setTab] = useState<"ledgers" | "recharges">("ledgers");
  const [busyId, setBusyId] = useState<number | null>(null);
  const busyLockRef = useRef(false);

  const handleInstantCancel = (item: WalletRechargeItemView) => {
    if (busyLockRef.current) return;
    openAlert({
      title: "포인트 충전을 바로 취소할까요?",
      description: `미사용 ${item.pointAmount.toLocaleString("ko-KR")}P가 즉시 회수되고 ${item.paidAmount.toLocaleString("ko-KR")}원 결제가 취소됩니다.`,
      confirmLabel: "바로 취소",
      cancelLabel: "유지",
      tone: "destructive",
      onConfirm: async () => {
        if (busyLockRef.current) return;
        busyLockRef.current = true;
        setBusyId(item.id);
        try {
          const res = await cancelMyRechargeAction(item.id);
          if (!res.ok) {
            openAlert({ title: "취소 불가", description: res.error.message, tone: "destructive" });
            return;
          }
          router.refresh();
          openAlert({
            title: "충전 결제가 취소되었습니다",
            description: `${res.data.refundedCash.toLocaleString("ko-KR")}원 취소 및 ${res.data.refundedPoints.toLocaleString("ko-KR")}P 회수가 완료되었습니다.`,
          });
        } finally {
          busyLockRef.current = false;
          setBusyId(null);
        }
      },
    });
  };

  const handleOpenRefundSheet = (item: WalletRechargeItemView) => {
    if (busyLockRef.current) return;
    openModal({
      id: `recharge-refund-${item.id}`,
      title: "잔여 포인트 환불 신청",
      subtitle: `${item.paidAtText} 결제 건`,
      direction: "slide-up",
      content: <RechargeRefundSheetForm item={item} onDone={closeTopModal} />,
    });
  };

  const handleWithdraw = (item: WalletRechargeItemView) => {
    if (busyLockRef.current) return;
    openAlert({
      title: "환불 신청을 철회할까요?",
      description: "접수된 환불 신청을 취소하고 포인트를 그대로 유지합니다.",
      confirmLabel: "신청 철회",
      cancelLabel: "닫기",
      onConfirm: async () => {
        if (busyLockRef.current) return;
        busyLockRef.current = true;
        setBusyId(item.id);
        try {
          const res = await withdrawRechargeRefundAction(item.id);
          if (!res.ok) {
            openAlert({ title: "철회 실패", description: res.error.message, tone: "destructive" });
            return;
          }
          router.refresh();
        } finally {
          busyLockRef.current = false;
          setBusyId(null);
        }
      },
    });
  };

  const handleIapNotice = (channel: "IOS_IAP" | "ANDROID_IAP") => {
    openAlert({
      title: `${CHANNEL_LABEL[channel]} 환불 안내`,
      description:
        channel === "IOS_IAP"
          ? "Apple App Store 정책상 인앱결제 환불은 Apple(reportaproblem.apple.com)에서 직접 신청해 주셔야 합니다."
          : "Google Play 정책상 인앱결제 환불은 Google Play 주문 내역에서 직접 신청해 주셔야 합니다.",
    });
  };

  return (
    <section className="flex flex-1 flex-col space-y-4">
      <AppSegmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "ledgers", label: "포인트 내역" },
          { value: "recharges", label: "충전 · 환불" },
        ]}
      />

      {tab === "ledgers" ? (
        ledgers.length === 0 ? (
          <EmptyStateCard
            mode="section"
            icon={<PointIcon variant="outline" className="size-5.5" strokeWidth={1.7} />}
            title="아직 포인트 거래 내역이 없습니다"
            description="교육 학습이나 출석 보상으로 첫 포인트를 모아 보세요."
          />
        ) : (
          <ul className="divide-y divide-border-subtle border-t border-border-subtle">
            {ledgers.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{row.title}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                    {row.createdAtText} · 잔액 {row.balanceAfter.toLocaleString("ko-KR")}P
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-extrabold tabular-nums ${
                    row.delta >= 0 ? "text-brand-strong" : "text-destructive"
                  }`}
                >
                  {row.delta >= 0 ? "+" : ""}
                  {row.delta.toLocaleString("ko-KR")}P
                </span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="flex flex-1 flex-col space-y-3">
          <p className="rounded-2xl bg-surface-subtle px-4 py-3 text-xs leading-relaxed text-ink-muted">
            • 미사용 충전분은 결제 후 7일 이내 <strong className="font-semibold text-ink">바로 취소</strong>가
            가능합니다.
            <br />• 일부 사용했거나 7일이 경과한 충전분은 잔여 포인트에 한해{" "}
            <strong className="font-semibold text-ink">환불 신청</strong> 후 관리자 확인을 거쳐 처리됩니다.
          </p>

          {recharges.length === 0 ? (
            <EmptyStateCard
              mode="section"
              icon={<Receipt className="size-5.5" strokeWidth={1.7} />}
              title="아직 충전 결제 내역이 없습니다"
              description="상단 포인트 충전 버튼으로 간편하게 충전할 수 있어요."
            />
          ) : (
            <ul className="divide-y divide-border-subtle border-t border-border-subtle">
              {recharges.map((item) => {
                const statusMeta = RECHARGE_STATUS_META[item.status] ?? {
                  label: item.status,
                  tone: "neutral" as const,
                };
                const isBusy = busyId === item.id;

                return (
                  <li key={item.id} className="space-y-2 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <AppBadge tone={statusMeta.tone}>{statusMeta.label}</AppBadge>
                          <span className="text-xs font-medium text-ink-muted">
                            {CHANNEL_LABEL[item.channel]}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-extrabold tabular-nums text-ink">
                          {item.pointAmount.toLocaleString("ko-KR")} P{" "}
                          <span className="font-semibold text-ink-muted">
                            ({item.paidAmount.toLocaleString("ko-KR")}원)
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                          {item.paidAtText}
                          {item.status === "PAID" || item.status === "REFUND_REQUESTED"
                            ? ` · 남은 포인트 ${item.remainingPoints.toLocaleString("ko-KR")}P`
                            : ""}
                        </p>
                      </div>

                      <div className="shrink-0 pt-0.5">
                        {item.actionMode === "INSTANT_CANCEL" && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleInstantCancel(item)}
                            className="inline-flex h-8 items-center justify-center rounded-xl border border-destructive/45 bg-transparent px-3 text-xs font-bold text-destructive transition-[transform,background-color] duration-150 hover:bg-destructive/10 active:scale-[0.97] disabled:opacity-45"
                          >
                            {isBusy ? "취소 중..." : "바로 취소"}
                          </button>
                        )}
                        {item.actionMode === "REQUEST_REFUND" && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleOpenRefundSheet(item)}
                            className="inline-flex h-8 items-center justify-center rounded-xl border border-ink/25 bg-transparent px-3 text-xs font-bold text-ink transition-[transform,background-color] duration-150 hover:bg-surface-subtle active:scale-[0.97] disabled:opacity-45"
                          >
                            환불 신청
                          </button>
                        )}
                        {item.actionMode === "REQUESTED" && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleWithdraw(item)}
                            className="inline-flex h-8 items-center justify-center rounded-xl border border-border-subtle bg-transparent px-3 text-xs font-semibold text-ink-muted transition-colors hover:bg-surface-subtle disabled:opacity-45"
                          >
                            {isBusy ? "처리 중..." : "신청 철회"}
                          </button>
                        )}
                        {item.actionMode === "IAP_STORE" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleIapNotice(
                                item.channel === "IOS_IAP" ? "IOS_IAP" : "ANDROID_IAP",
                              )
                            }
                            className="inline-flex h-8 items-center justify-center rounded-xl border border-border-subtle bg-transparent px-3 text-xs font-semibold text-ink-muted transition-colors hover:bg-surface-subtle"
                          >
                            스토어 안내
                          </button>
                        )}
                        {item.actionMode === "FULLY_USED" && (
                          <span className="text-xs font-medium text-ink-muted">사용 완료</span>
                        )}
                      </div>
                    </div>

                    {item.status === "REFUND_REQUESTED" && item.refundReason && (
                      <p className="rounded-xl bg-surface-subtle px-3 py-2 text-xs text-ink-muted">
                        환불 신청 사유:{" "}
                        <span className="font-medium text-ink">{item.refundReason}</span>
                      </p>
                    )}

                    {item.status === "REFUNDED" && (
                      <p className="rounded-xl bg-surface-subtle px-3 py-2 text-xs tabular-nums text-ink-muted">
                        환불 완료 ({item.refundedAtText ?? "-"}) ·{" "}
                        {(item.refundedCashAmount ?? item.paidAmount).toLocaleString("ko-KR")}원 취소
                        · {(item.refundedPointAmount ?? item.pointAmount).toLocaleString("ko-KR")}P
                        회수
                      </p>
                    )}

                    {item.status === "PAID" && item.adminRejectReason && (
                      <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        환불 반려 사유: {item.adminRejectReason}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
