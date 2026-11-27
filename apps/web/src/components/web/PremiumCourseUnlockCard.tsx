"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Lock, Ticket } from "lucide-react";
import { cn, PointIcon } from "@repo/ui";
import { useModalStore } from "@/01_store/web/useModalStore";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { createClientRequestKey, useSubmitLock } from "@/02_hooks/useSubmitLock";
import {
  redeemCourseTicketAction,
  unlockPremiumCourseWithPointsAction,
} from "@/03_actions/web/ticketActions";
import type { RechargePackagePolicy } from "@/04_services/shared/policyService";
import { RechargeClient } from "@/components/web/RechargeClient";
import { AppButton, AppLink, AppLinkButton } from "@/components/web/ui";

export interface PremiumUnlockSheetProps {
  courseId: number;
  courseTitle: string;
  dogId?: number;
  dogName?: string;
  pointPrice: number | null;
  productId: number | null;
  walletBalance: number;
  rechargePackages: RechargePackagePolicy[];
  availableTicket: { id: number; title: string; issuedAtText?: string } | null;
}

function PremiumUnlockSheetContent({
  courseId,
  courseTitle,
  dogId,
  dogName,
  pointPrice,
  productId,
  walletBalance,
  rechargePackages,
  availableTicket,
  onDone,
}: PremiumUnlockSheetProps & { onDone: () => void }) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const { pending, run } = useSubmitLock();
  const [liveBalance, setLiveBalance] = useState(walletBalance);
  const [showRechargeStep, setShowRechargeStep] = useState(false);
  const [method, setMethod] = useState<"POINT" | "TICKET">(
    availableTicket ? "TICKET" : "POINT",
  );
  const requestKeyRef = useRef<string>(createClientRequestKey("crs"));

  useEffect(() => {
    setLiveBalance(walletBalance);
  }, [walletBalance]);

  useEffect(() => {
    requestKeyRef.current = createClientRequestKey("crs");
  }, [liveBalance, courseId]);

  const shortage = pointPrice !== null ? Math.max(0, pointPrice - liveBalance) : 0;

  const handleConfirm = () => {
    if (pending) return;

    if (method === "TICKET" && availableTicket) {
      void run(async () => {
        const res = await redeemCourseTicketAction({
          ticketId: availableTicket.id,
          dogId,
        });
        if (!res.ok) {
          openAlert({
            title: "티켓 사용 실패",
            description: res.error.message,
            tone: "destructive",
          });
          return;
        }
        onDone();
        router.refresh();
        openAlert({
          title: "프리미엄 강좌 잠금 해제 완료",
          description: `티켓에 멍멍이 발 도장이 찍혔어요.${dogName ? ` ${dogName}의 내 강좌 목록에도 자동으로 담겼습니다.` : ""}`,
        });
      });
      return;
    }

    if (pointPrice === null) return;
    void run(async () => {
      const res = await unlockPremiumCourseWithPointsAction({
        courseId,
        dogId,
        idempotencyKey: requestKeyRef.current,
        expectedWalletBalance: liveBalance,
      });
      if (!res.ok) {
        if (res.error.code === "BALANCE_STALE") {
          if (typeof res.error.latestBalance === "number") {
            setLiveBalance(res.error.latestBalance);
          }
          requestKeyRef.current = createClientRequestKey("crs");
          router.refresh();
        }
        openAlert({
          title: "잠금 해제 실패",
          description: res.error.message,
          tone: "destructive",
        });
        return;
      }
      onDone();
      router.refresh();
      openAlert({
        title: "프리미엄 강좌 잠금 해제 완료",
        description: `${res.data.paidPoints.toLocaleString("ko-KR")}P가 차감되었어요.${dogName ? ` ${dogName}의 내 강좌 목록에도 자동으로 담겼습니다.` : ""}`,
      });
    });
  };

  if (showRechargeStep) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowRechargeStep(false)}
          className="inline-flex items-center gap-1 text-xs font-bold text-ink-muted transition-colors hover:text-ink"
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
          잠금 해제로 돌아가기
        </button>
        <RechargeClient
          packages={rechargePackages}
          walletBalance={liveBalance}
          requiredShortfall={shortage > 0 ? shortage : undefined}
          onBalanceSync={(latest) => setLiveBalance(latest)}
          onCompleted={({ pointAmount }) => {
            setLiveBalance((b) => b + pointAmount);
            setShowRechargeStep(false);
            openAlert({
              title: `+${pointAmount.toLocaleString("ko-KR")} P 충전 완료`,
              description: "보유 포인트가 즉시 반영되었습니다. 지금 바로 잠금 해제할 수 있어요.",
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-ink-muted">
        잠금 해제 시 <strong className="font-bold text-ink">{courseTitle}</strong>의 모든 강의를
        기간 제한 없이 수강할 수 있어요.
      </p>

      {/* 1. 기본 옵션: 포인트 차감으로 바로 구매 */}
      <button
        type="button"
        onClick={() => setMethod("POINT")}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left transition-colors",
          method === "POINT"
            ? "bg-surface ring-2 ring-brand"
            : "bg-surface-subtle hover:bg-surface-subtle/80",
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
              method === "POINT" ? "bg-brand text-white" : "border border-border-strong bg-surface",
            )}
          >
            {method === "POINT" && <Check className="size-3" strokeWidth={2.8} />}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
              <PointIcon className="size-4 shrink-0" />
              포인트로 바로 구매
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
              보유 {liveBalance.toLocaleString("ko-KR")}P
              {shortage > 0 && (
                <span className="ml-1 font-semibold text-destructive">
                  ({shortage.toLocaleString("ko-KR")}P 부족)
                </span>
              )}
            </p>
          </div>
        </div>
        {pointPrice !== null && (
          <strong className="shrink-0 text-sm font-extrabold tabular-nums text-ink">
            {pointPrice.toLocaleString("ko-KR")}P
          </strong>
        )}
      </button>

      {/* 2. 보유 티켓이 있을 경우: 아래에 미니 비행기표 티켓 카드 표시 */}
      {availableTicket && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 font-extrabold text-brand-strong">
              <Ticket className="size-3.5" strokeWidth={2.2} />
              보유 중인 티켓 (1장)
            </span>
            <span className="font-semibold text-ink-muted">선택 시 포인트 차감 없음</span>
          </div>

          <button
            type="button"
            onClick={() => setMethod("TICKET")}
            className="waggle-ticket-wrap block w-full text-left transition-transform active:scale-[0.99]"
          >
            <div
              className={cn(
                "waggle-ticket-body waggle-ticket-body-sm flex items-stretch rounded-none transition-colors",
                method === "TICKET" ? "bg-brand-soft/60" : "bg-surface",
              )}
            >
              {/* 좌측 직각 컬러 바 */}
              <div aria-hidden="true" className="w-1 shrink-0 bg-brand" />

              {/* 좌측 티켓 정보 */}
              <div className="flex min-w-0 flex-1 items-center gap-2.5 py-3.5 pl-3.5 pr-3">
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full",
                    method === "TICKET"
                      ? "bg-brand text-white"
                      : "border border-border-strong bg-surface",
                  )}
                >
                  {method === "TICKET" && <Check className="size-3" strokeWidth={2.8} />}
                </span>
                <div className="min-w-0">
                  <p className="text-2xs font-bold text-brand-strong">프리미엄 강좌 티켓</p>
                  <p className="mt-0.5 truncate text-xs font-extrabold text-ink">
                    {availableTicket.title}
                  </p>
                </div>
              </div>

              {/* 점선 절취선 */}
              <div
                aria-hidden="true"
                className="my-2.5 w-px shrink-0 border-l-2 border-dashed border-ink/15"
              />

              {/* 우측 0P 도장 스텁 (w-22 = 5.5rem) */}
              <div className="flex w-22 shrink-0 flex-col items-center justify-center px-2 py-3">
                <div className="-rotate-6 rounded-lg border-2 border-brand/75 bg-surface/90 px-2 py-1 text-center">
                  <span className="block text-xs font-extrabold leading-none tabular-nums text-brand-strong">
                    0P
                  </span>
                  <span className="mt-0.5 block text-2xs font-bold leading-none text-brand-strong">
                    티켓적용
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* 하단 실행 버튼 */}
      <div className="space-y-2.5 pt-1">
        {method === "TICKET" && availableTicket ? (
          <AppButton
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            loading={pending}
            onClick={handleConfirm}
          >
            <Ticket className="size-4" strokeWidth={2} />
            {pending ? "티켓 사용 중..." : "보유 티켓으로 잠금 해제 (0P)"}
          </AppButton>
        ) : pointPrice !== null && shortage === 0 ? (
          <AppButton
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            loading={pending}
            onClick={handleConfirm}
          >
            {pending
              ? "잠금 해제 중..."
              : `${pointPrice.toLocaleString("ko-KR")}P 차감하고 잠금 해제`}
          </AppButton>
        ) : pointPrice !== null && shortage > 0 && rechargePackages.length > 0 ? (
          <AppButton
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => setShowRechargeStep(true)}
          >
            부족한 {shortage.toLocaleString("ko-KR")} P 충전하기
          </AppButton>
        ) : pointPrice !== null && shortage > 0 ? (
          <AppLinkButton
            href="/app/wallet/recharge"
            variant="primary"
            size="lg"
            fullWidth
            onClick={onDone}
          >
            포인트 충전하고 잠금 해제
          </AppLinkButton>
        ) : (
          <AppLinkButton href="/app/shop" variant="primary" size="lg" fullWidth onClick={onDone}>
            포인트샵에서 확인하기
          </AppLinkButton>
        )}

        <div className="flex items-center justify-between text-xs">
          <AppLink
            href="/app/my/tickets"
            onClick={onDone}
            className="font-medium text-ink-muted transition-colors hover:text-ink"
          >
            내 티켓함 보기
          </AppLink>
          {!availableTicket && (
            <AppLink
              href={productId ? `/app/shop/products/${productId}` : "/app/shop"}
              onClick={onDone}
              className="inline-flex items-center gap-0.5 font-semibold text-ink-muted transition-colors hover:text-ink"
            >
              포인트샵에서 티켓 구매
              <ChevronRight className="size-3.5" strokeWidth={2} />
            </AppLink>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 코스 상세 상단 잠금 해제 버튼 또는 잠긴 레슨 행 클릭 트리거
 * - 클릭 시 하단 바텀시트(구매 + 보유 티켓 카드) 오픈
 */
export function PremiumUnlockSheetTrigger({
  props,
  children,
}: {
  props: PremiumUnlockSheetProps;
  children?: React.ReactNode;
}) {
  const openModal = useModalStore((s) => s.openModal);
  const closeTopModal = useModalStore((s) => s.closeTopModal);

  const handleOpen = () => {
    openModal({
      id: `premium-unlock-course-${props.courseId}`,
      title: "프리미엄 강좌 잠금 해제",
      subtitle: props.availableTicket
        ? "보유 티켓으로 0P 잠금 해제가 가능합니다"
        : "포인트 차감으로 바로 수강을 시작해 보세요",
      direction: "slide-up",
      content: <PremiumUnlockSheetContent {...props} onDone={closeTopModal} />,
    });
  };

  if (children) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="block w-full text-left transition-opacity active:opacity-70"
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-brand px-4 py-3.5 text-left text-white transition-transform active:scale-[0.99]"
    >
      <span className="inline-flex items-center gap-2 text-sm font-extrabold">
        <Lock className="size-4 shrink-0" strokeWidth={2.2} />
        프리미엄 잠금 해제하기
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold tabular-nums">
        {props.availableTicket ? (
          <>
            <Ticket className="size-3.5" strokeWidth={2.2} />
            티켓 보유 · 0P
          </>
        ) : props.pointPrice !== null ? (
          `${props.pointPrice.toLocaleString("ko-KR")}P`
        ) : (
          "확인"
        )}
      </span>
    </button>
  );
}
