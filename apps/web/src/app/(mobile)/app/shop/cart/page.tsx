import { ShoppingCart } from "lucide-react";
import { and, cartItems, carts, eq, getDb, products, productVariants } from "@repo/db";
import { requireUserSession } from "@/00_lib/session";
import { getWalletSummary } from "@/04_services/shared/pointLedgerService";
import { getRechargePackagesPolicy } from "@/04_services/shared/policyService";
import { getPrimaryProductImagesMap } from "@/04_services/shared/shopReviewService";
import { CartClient, type CartItemView } from "@/components/web/CartClient";
import { EmptyStateCard, SubPageHeader } from "@/components/web/WebUiKit";

export const dynamic = "force-dynamic";

export default async function ShopCartPage() {
  const session = await requireUserSession();
  const db = getDb();

  const [[cart], wallet, rechargePackages] = await Promise.all([
    db
      .select()
      .from(carts)
      .where(and(eq(carts.userId, session.userId), eq(carts.isDeleted, false)))
      .limit(1),
    getWalletSummary(session.userId),
    getRechargePackagesPolicy(),
  ]);

  let items: CartItemView[] = [];
  if (cart) {
    const raw = await db
      .select({
        id: cartItems.id,
        productId: cartItems.productId,
        quantity: cartItems.quantity,
        productName: products.name,
        basePoint: products.pointPrice,
        variantId: cartItems.variantId,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.isDeleted, false)));

    const productIds = Array.from(new Set(raw.map((r) => r.productId)));
    const [allVars, imageMap] = await Promise.all([
      db.select().from(productVariants).where(eq(productVariants.isDeleted, false)),
      getPrimaryProductImagesMap(productIds),
    ]);
    const varMap = new Map(allVars.map((v) => [v.id, v]));

    items = raw.map((r) => {
      const v = r.variantId ? varMap.get(r.variantId) : undefined;
      return {
        id: r.id,
        productId: r.productId,
        productName: r.productName,
        variantName: v?.name ?? null,
        thumbnailUrl: imageMap.get(r.productId) ?? null,
        unitPoint: r.basePoint + (v?.addPoint ?? 0),
        quantity: r.quantity,
      };
    });
  }

  return (
    <div className="flex flex-1 flex-col space-y-4">
      <SubPageHeader title="장바구니" backHref="/app/shop" />
      {items.length > 0 ? (
        <CartClient
          items={items}
          walletBalance={wallet.balance}
          rechargePackages={rechargePackages}
        />
      ) : (
        <EmptyStateCard
          icon={<ShoppingCart className="size-5.5" strokeWidth={1.7} />}
          title="장바구니가 비어 있어요"
          description="포인트샵에서 원하는 간식이나 프리미엄 코스를 담아 보세요."
          ctaLabel="포인트샵 가기"
          ctaHref="/app/shop"
        />
      )}
    </div>
  );
}
