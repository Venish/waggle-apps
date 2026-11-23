"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { getMobileForwardTransitionTypes } from "@/00_lib/mobileRoutePresentation";
import { useSubmitLock } from "@/02_hooks/useSubmitLock";
import { addToCartAction } from "@/03_actions/web/walletShopActions";
import { useModalStore } from "@/01_store/web/useModalStore";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { SubPageBottomBar } from "@/components/web/WebUiKit";
import { AppButton, AppChoiceCard, AppLinkButton } from "@/components/web/ui";

export interface VariantOpt {
  id: number;
  name: string;
  addPoint: number;
  stock: number;
}

export function ProductBuyClient({
  productId,
  basePointPrice,
  variants,
  singleQtyOnly = false,
}: {
  productId: number;
  basePointPrice: number;
  variants: VariantOpt[];
  singleQtyOnly?: boolean;
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const closeTopModal = useModalStore((s) => s.closeTopModal);
  const dismissForNavigation = useModalStore((s) => s.dismissForNavigation);
  const firstAvailableVariant = variants.find((v) => v.stock > 0) ?? variants[0];
  const [variantId, setVariantId] = useState<number | null>(firstAvailableVariant?.id ?? null);
  const [qty, setQty] = useState(1);
  const { pending, run } = useSubmitLock();

  const selectedVariant = variants.find((v) => v.id === variantId);
  const selectedSoldOut = selectedVariant ? selectedVariant.stock <= 0 : false;
  const maxQty = singleQtyOnly
    ? 1
    : selectedVariant
      ? Math.max(1, Math.min(20, selectedVariant.stock))
      : 20;
  const unitPrice = basePointPrice + (selectedVariant?.addPoint ?? 0);

  const handleAddCart = () => {
    void run(async () => {
      const res = await addToCartAction({ productId, variantId, quantity: qty });
      if (!res.ok) {
        openAlert({
          title: "장바구니 담기 실패",
          description: res.error.message,
          tone: "destructive",
        });
        return;
      }
      closeTopModal();
      openAlert({
        title: "장바구니에 담았습니다",
        confirmLabel: "장바구니로 이동",
        cancelLabel: "계속 쇼핑",
        onConfirm: () =>
          router.push("/app/shop/cart", {
            transitionTypes: getMobileForwardTransitionTypes("/app/shop/cart"),
          }),
      });
    });
  };

  const handleDirectBuy = () => {
    const q = new URLSearchParams({
      productId: String(productId),
      qty: String(qty),
      ...(variantId ? { variantId: String(variantId) } : {}),
    });
    const url = `/app/shop/checkout?${q.toString()}`;
    const transitionTypes = getMobileForwardTransitionTypes(url);
    if (dismissForNavigation()) {
      router.replace(url, { transitionTypes });
    } else {
      router.push(url, { transitionTypes });
    }
  };

  return (
    <div className="space-y-5">
      {variants.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-medium text-ink-muted">옵션 선택</p>
          <div className="space-y-2" role="radiogroup" aria-label="상품 옵션">
            {variants.map((v) => {
              const outOfStock = v.stock <= 0;
              const alreadyShowsPrice = /\(\+[\d,]+P\)/i.test(v.name);
              return (
                <AppChoiceCard
                  key={v.id}
                  selected={variantId === v.id}
                  disabled={outOfStock}
                  onClick={() => {
                    if (outOfStock) return;
                    setVariantId(v.id);
                    setQty((prev) => Math.min(prev, Math.max(1, Math.min(20, v.stock))));
                  }}
                  title={v.name}
                  right={
                    outOfStock ? (
                      <span className="text-xs font-semibold text-destructive">품절</span>
                    ) : (
                      <span className="text-xs font-semibold tabular-nums text-ink-muted">
                        {v.addPoint > 0 && !alreadyShowsPrice
                          ? `+${v.addPoint.toLocaleString("ko-KR")}P · `
                          : ""}
                        재고 {v.stock}
                      </span>
                    )
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between border-y border-border-subtle py-3.5">
        <span className="text-sm font-semibold text-ink">수량</span>
        {singleQtyOnly ? (
          <span className="text-sm font-bold tabular-nums text-ink">1장 (계정당 1회)</span>
        ) : (
          <div className="inline-flex items-center gap-1 rounded-xl bg-surface-subtle p-0.5">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="수량 감소"
              className="flex size-8 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface active:scale-95"
            >
              <Minus className="size-3.5" strokeWidth={2.2} />
            </button>
            <span className="w-7 text-center text-sm font-bold tabular-nums text-ink">{qty}</span>
            <button
              type="button"
              disabled={qty >= maxQty}
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              aria-label="수량 증가"
              className="flex size-8 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface active:scale-95 disabled:opacity-40"
            >
              <Plus className="size-3.5" strokeWidth={2.2} />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-muted">합계 포인트</span>
        <span className="text-xl font-extrabold tabular-nums text-ink">
          {(unitPrice * qty).toLocaleString("ko-KR")} P
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <AppButton
          variant="secondary"
          size="lg"
          disabled={selectedSoldOut}
          loading={pending}
          onClick={handleAddCart}
        >
          장바구니
        </AppButton>
        <AppButton variant="primary" size="lg" disabled={selectedSoldOut} onClick={handleDirectBuy}>
          바로 구매
        </AppButton>
      </div>
    </div>
  );
}

/**
 * 상품 상세 하단 고정 CTA 바 — 클릭 시 배경(상품 상세)을 유지한 채 옵션·수량 시트 오픈
 */
export function ProductBuySheetBar({
  productId,
  productName,
  basePointPrice,
  variants,
  isSoldOut = false,
  singleQtyOnly = false,
  overrideCta,
}: {
  productId: number;
  productName: string;
  basePointPrice: number;
  variants: VariantOpt[];
  isSoldOut?: boolean;
  singleQtyOnly?: boolean;
  overrideCta?: { label: string; href: string } | null;
}) {
  const openModal = useModalStore((s) => s.openModal);

  const handleOpenBuySheet = () => {
    if (isSoldOut) return;
    openModal({
      id: `product-buy-${productId}`,
      title: productName,
      subtitle: variants.length > 0
        ? "옵션과 수량을 선택해 주세요"
        : singleQtyOnly
          ? "결제 후 내 티켓함에 보관됩니다"
          : "수량을 선택해 주세요",
      direction: "slide-up",
      content: (
        <ProductBuyClient
          productId={productId}
          basePointPrice={basePointPrice}
          variants={variants}
          singleQtyOnly={singleQtyOnly}
        />
      ),
    });
  };

  return (
    <SubPageBottomBar>
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <p className="text-xs font-medium text-ink-muted">판매 포인트</p>
          <p className="text-lg font-extrabold tabular-nums text-ink">
            {basePointPrice.toLocaleString("ko-KR")} P
          </p>
        </div>
        {overrideCta ? (
          <AppLinkButton href={overrideCta.href} variant="secondary" size="lg" className="flex-1">
            {overrideCta.label}
          </AppLinkButton>
        ) : (
          <AppButton
            variant={isSoldOut ? "secondary" : "primary"}
            size="lg"
            disabled={isSoldOut}
            className="flex-1"
            onClick={handleOpenBuySheet}
          >
            {isSoldOut ? "품절된 상품입니다" : "구매하기"}
          </AppButton>
        )}
      </div>
    </SubPageBottomBar>
  );
}
