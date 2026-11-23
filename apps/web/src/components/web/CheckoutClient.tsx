"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";
import { WaggleMark } from "@repo/ui";
import { resetAppNavTo } from "@/00_lib/mobileNavHistory";
import { getMobileForwardTransitionTypes } from "@/00_lib/mobileRoutePresentation";
import { createClientRequestKey, useSubmitLock } from "@/02_hooks/useSubmitLock";
import { createShopOrderAction } from "@/03_actions/web/walletShopActions";
import type { RechargePackagePolicy } from "@/04_services/shared/policyService";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import {
  PointBalanceRechargeStrip,
  useInlineRechargeSheet,
} from "@/components/web/SheetTriggerButtons";
import { SubPageBottomBar } from "@/components/web/WebUiKit";
import { AppButton, AppInput } from "@/components/web/ui";

export interface CheckoutSummaryItem {
  productId: number;
  productName: string;
  variantName: string | null;
  thumbnailUrl: string | null;
  unitPoint: number;
  quantity: number;
}

export function CheckoutClient({
  walletBalance,
  rechargePackages,
  defaultAddress,
  summaryItems = [],
  hasPhysical = true,
  directProductId,
  directVariantId,
  directQuantity,
}: {
  walletBalance: number;
  rechargePackages: RechargePackagePolicy[];
  defaultAddress?: {
    receiver: string;
    phone: string;
    zipcode: string;
    addr1: string;
    addr2: string | null;
  } | null;
  summaryItems?: CheckoutSummaryItem[];
  hasPhysical?: boolean;
  directProductId?: number;
  directVariantId?: number | null;
  directQuantity?: number;
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const openInlineRecharge = useInlineRechargeSheet();

  const [liveBalance, setLiveBalance] = useState(walletBalance);
  const [receiver, setReceiver] = useState(defaultAddress?.receiver ?? "초코맘");
  const [phone, setPhone] = useState(defaultAddress?.phone ?? "010-9000-1234");
  const [zipcode, setZipcode] = useState(defaultAddress?.zipcode ?? "06236");
  const [addr1, setAddr1] = useState(defaultAddress?.addr1 ?? "서울 강남구 테헤란로 123");
  const [addr2, setAddr2] = useState(defaultAddress?.addr2 ?? "101동 1004호");
  const { pending, run } = useSubmitLock();
  const requestKeyRef = useRef<string>(createClientRequestKey("ord"));

  const totalPoint = summaryItems.reduce((sum, item) => sum + item.unitPoint * item.quantity, 0);
  const pointShortfall = totalPoint > 0 ? Math.max(0, totalPoint - liveBalance) : 0;

  useEffect(() => {
    setLiveBalance(walletBalance);
  }, [walletBalance]);

  useEffect(() => {
    requestKeyRef.current = createClientRequestKey("ord");
  }, [liveBalance, directProductId, directVariantId, directQuantity]);

  const handleOrder = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await createShopOrderAction({
        receiver: hasPhysical ? receiver : undefined,
        phone: hasPhysical ? phone : undefined,
        zipcode: hasPhysical ? zipcode : undefined,
        addr1: hasPhysical ? addr1 : undefined,
        addr2: hasPhysical ? addr2 : undefined,
        directProductId,
        directVariantId,
        directQuantity,
        idempotencyKey: requestKeyRef.current,
        expectedWalletBalance: liveBalance,
      });
      if (!res.ok) {
        if (res.error.code === "BALANCE_STALE") {
          if (typeof res.error.latestBalance === "number") {
            setLiveBalance(res.error.latestBalance);
          }
          requestKeyRef.current = createClientRequestKey("ord");
          router.refresh();
        }
        openAlert({
          title: res.error.code === "BALANCE_STALE" ? "보유 포인트 변경 안내" : "주문 실패",
          description: res.error.message,
          tone: "destructive",
        });
        return;
      }
      if (res.data.issuedTickets.length > 0) {
        const hasCourseTicket = res.data.issuedTickets.some(
          (t) => t.ticketType === "PREMIUM_UNLOCK" && t.courseId,
        );
        openAlert({
          title:
            res.data.issuedTickets.length === 1
              ? "티켓이 발급되었어요"
              : `티켓 ${res.data.issuedTickets.length}장이 발급되었어요`,
          description: hasCourseTicket
            ? `주문번호: ${res.data.orderNo}\n내 티켓함에 보관되었습니다. 해당 교육 코스의 잠금을 누르면 보유 티켓으로 바로 열 수 있어요.`
            : `주문번호: ${res.data.orderNo}\n내 티켓함에서 발급된 티켓 상태를 확인할 수 있습니다.`,
          confirmLabel: "내 티켓함 보기",
          onConfirm: () => {
            resetAppNavTo("/app/shop");
            router.replace("/app/my/tickets", {
              transitionTypes: getMobileForwardTransitionTypes("/app/my/tickets"),
            });
          },
        });
        return;
      }

      openAlert({
        title: "주문이 완료되었습니다",
        description: `주문번호: ${res.data.orderNo}`,
        confirmLabel: "주문내역 확인",
        onConfirm: () => {
          resetAppNavTo("/app/shop");
          router.replace("/app/shop/orders", {
            transitionTypes: getMobileForwardTransitionTypes("/app/shop/orders"),
          });
          router.refresh();
        },
      });
    });
  };

  return (
    <>
      <form id="shop-checkout-form" noValidate onSubmit={handleOrder} className="space-y-6 pb-24">
        {/* 주문 상품 요약 */}
        {summaryItems.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold tracking-tight text-ink">
              주문 상품 ({summaryItems.length})
            </h2>
            <ul className="divide-y divide-border-subtle rounded-2xl bg-surface-subtle px-3.5">
              {summaryItems.map((item, idx) => (
                <li key={`${item.productId}-${idx}`} className="flex items-center gap-3 py-3">
                  <div className="size-13 shrink-0 overflow-hidden rounded-xl bg-surface">
                    {item.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailUrl}
                        alt={item.productName}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-brand">
                        <WaggleMark className="w-[46%] text-surface/95" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-bold text-ink">{item.productName}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {item.variantName ? `${item.variantName} · ` : ""}
                      <span className="tabular-nums">{item.quantity}개</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold tabular-nums text-ink">
                    {(item.unitPoint * item.quantity).toLocaleString("ko-KR")} P
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between px-1 text-sm">
              <span className="font-semibold text-ink-muted">총 결제 포인트</span>
              <strong className="text-lg font-extrabold tabular-nums text-ink">
                {totalPoint.toLocaleString("ko-KR")} P
              </strong>
            </div>
          </section>
        )}

        <PointBalanceRechargeStrip
          walletBalance={liveBalance}
          requiredPoint={totalPoint > 0 ? totalPoint : undefined}
          packages={rechargePackages}
          onRecharged={(pointAmount) => setLiveBalance((b) => b + pointAmount)}
        />

        {hasPhysical ? (
          <section className="space-y-5">
            <h2 className="text-sm font-bold tracking-tight text-ink">배송지 정보</h2>

            <AppInput
              id="checkout-receiver"
              label="수령인 *"
              type="text"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              clearable
              onClear={() => setReceiver("")}
              placeholder="수령인 이름"
            />

            <AppInput
              id="checkout-phone"
              label="연락처 *"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              clearable
              onClear={() => setPhone("")}
              placeholder="010-0000-0000"
              className="tabular-nums"
            />

            <AppInput
              id="checkout-zipcode"
              label="우편번호 *"
              type="text"
              inputMode="numeric"
              value={zipcode}
              onChange={(e) => setZipcode(e.target.value)}
              placeholder="우편번호"
              className="tabular-nums"
            />

            <AppInput
              id="checkout-addr1"
              label="기본 주소 *"
              type="text"
              value={addr1}
              onChange={(e) => setAddr1(e.target.value)}
              placeholder="도로명 / 지번 주소"
            />

            <AppInput
              id="checkout-addr2"
              label="상세 주소"
              type="text"
              value={addr2}
              onChange={(e) => setAddr2(e.target.value)}
              placeholder="동·호수 등 상세 주소"
            />
          </section>
        ) : (
          <div className="flex items-start gap-2.5 rounded-2xl bg-surface-subtle px-4 py-3.5 text-xs leading-relaxed text-ink-muted">
            <Ticket className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2} />
            <p>
              배송지가 필요 없는 디지털 티켓 상품입니다. 결제 완료 즉시{" "}
              <strong className="font-bold text-ink">내 티켓 · 이용권함</strong>에 발급됩니다.
            </p>
          </div>
        )}
      </form>

      <SubPageBottomBar>
        {pointShortfall > 0 && rechargePackages.length > 0 ? (
          <AppButton
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={() =>
              openInlineRecharge({
                packages: rechargePackages,
                walletBalance: liveBalance,
                requiredShortfall: pointShortfall,
                onRecharged: (pointAmount) => setLiveBalance((b) => b + pointAmount),
              })
            }
          >
            부족한 {pointShortfall.toLocaleString("ko-KR")} P 충전하기
          </AppButton>
        ) : (
          <AppButton
            type="submit"
            form="shop-checkout-form"
            variant="primary"
            size="lg"
            fullWidth
            loading={pending}
          >
            {pending
              ? "결제 처리 중..."
              : totalPoint > 0
                ? `${totalPoint.toLocaleString("ko-KR")} P 결제하기`
                : "포인트로 결제하기"}
          </AppButton>
        )}
      </SubPageBottomBar>
    </>
  );
}
