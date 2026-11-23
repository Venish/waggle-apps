"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { WaggleMark } from "@repo/ui";
import { updateCartItemQtyAction } from "@/03_actions/web/walletShopActions";
import type { RechargePackagePolicy } from "@/04_services/shared/policyService";
import { PointBalanceRechargeStrip } from "@/components/web/SheetTriggerButtons";
import { SubPageBottomBar } from "@/components/web/WebUiKit";
import { AppLink, AppLinkButton } from "@/components/web/ui";

export interface CartItemView {
  id: number;
  productId: number;
  productName: string;
  variantName: string | null;
  thumbnailUrl: string | null;
  unitPoint: number;
  quantity: number;
}

export function CartClient({
  items,
  walletBalance,
  rechargePackages,
}: {
  items: CartItemView[];
  walletBalance: number;
  rechargePackages: RechargePackagePolicy[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const lockRef = useRef(false);

  const totalPoint = items.reduce((sum, i) => sum + i.unitPoint * i.quantity, 0);

  const changeQty = async (id: number, nextQty: number) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setBusyId(id);
    try {
      await updateCartItemQtyAction(id, nextQty);
      router.refresh();
    } finally {
      lockRef.current = false;
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="space-y-5 pb-24">
        <PointBalanceRechargeStrip
          walletBalance={walletBalance}
          requiredPoint={totalPoint}
          packages={rechargePackages}
        />

        <ul className="divide-y divide-border-subtle border-y border-border-subtle">
          {items.map((item) => (
            <li key={item.id} className="space-y-3 py-4">
              <div className="flex items-start gap-3">
                <AppLink
                  href={`/app/shop/products/${item.productId}`}
                  className="size-16 shrink-0 overflow-hidden rounded-xl bg-surface-subtle"
                >
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
                </AppLink>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <AppLink
                      href={`/app/shop/products/${item.productId}`}
                      className="line-clamp-2 text-sm font-bold leading-snug text-ink hover:underline"
                    >
                      {item.productName}
                    </AppLink>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => changeQty(item.id, 0)}
                      aria-label="삭제"
                      className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-subtle hover:text-destructive active:opacity-70"
                    >
                      <Trash2 className="size-4" strokeWidth={1.9} />
                    </button>
                  </div>
                  {item.variantName && (
                    <p className="mt-0.5 text-xs text-ink-muted">옵션: {item.variantName}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1 rounded-xl bg-surface-subtle p-0.5">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => changeQty(item.id, item.quantity - 1)}
                    aria-label="수량 감소"
                    className="flex size-7 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface active:scale-95 disabled:opacity-40"
                  >
                    <Minus className="size-3.5" strokeWidth={2.2} />
                  </button>
                  <span className="w-7 text-center text-sm font-bold tabular-nums text-ink">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => changeQty(item.id, item.quantity + 1)}
                    aria-label="수량 증가"
                    className="flex size-7 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface active:scale-95 disabled:opacity-40"
                  >
                    <Plus className="size-3.5" strokeWidth={2.2} />
                  </button>
                </div>
                <span className="text-base font-extrabold tabular-nums text-ink">
                  {(item.unitPoint * item.quantity).toLocaleString("ko-KR")} P
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <SubPageBottomBar>
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <p className="text-xs font-medium text-ink-muted">총 결제 포인트</p>
            <p className="text-lg font-extrabold tabular-nums text-ink">
              {totalPoint.toLocaleString("ko-KR")} P
            </p>
          </div>
          <AppLinkButton href="/app/shop/checkout" variant="primary" size="lg" className="flex-1">
            주문하기
          </AppLinkButton>
        </div>
      </SubPageBottomBar>
    </>
  );
}
