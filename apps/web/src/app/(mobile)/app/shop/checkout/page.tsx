import {
  addresses,
  and,
  cartItems,
  carts,
  desc,
  eq,
  getDb,
  products,
  productVariants,
} from "@repo/db";
import { requireUserSession } from "@/00_lib/session";
import { getWalletSummary } from "@/04_services/shared/pointLedgerService";
import { getRechargePackagesPolicy } from "@/04_services/shared/policyService";
import { getPrimaryProductImagesMap } from "@/04_services/shared/shopReviewService";
import { CheckoutClient, type CheckoutSummaryItem } from "@/components/web/CheckoutClient";
import { SubPageHeader } from "@/components/web/WebUiKit";

export const dynamic = "force-dynamic";

export default async function ShopCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string; variantId?: string; qty?: string }>;
}) {
  const session = await requireUserSession();
  const db = getDb();
  const [params, wallet, rechargePackages, [savedAddress]] = await Promise.all([
    searchParams,
    getWalletSummary(session.userId),
    getRechargePackagesPolicy(),
    db
      .select({
        receiver: addresses.receiver,
        phone: addresses.phone,
        zipcode: addresses.zipcode,
        addr1: addresses.addr1,
        addr2: addresses.addr2,
      })
      .from(addresses)
      .where(and(eq(addresses.userId, session.userId), eq(addresses.isDeleted, false)))
      .orderBy(desc(addresses.isDefault), desc(addresses.id))
      .limit(1),
  ]);

  const directProductId = params.productId ? Number(params.productId) : undefined;
  const directVariantId = params.variantId ? Number(params.variantId) : null;
  const directQuantity = params.qty ? Math.max(1, Number(params.qty)) : undefined;

  let summaryItems: CheckoutSummaryItem[] = [];
  let hasPhysical = false;

  if (directProductId && Number.isInteger(directProductId)) {
    const [[prod], [variant], imageMap] = await Promise.all([
      db
        .select({
          id: products.id,
          type: products.type,
          name: products.name,
          pointPrice: products.pointPrice,
        })
        .from(products)
        .where(and(eq(products.id, directProductId), eq(products.isDeleted, false)))
        .limit(1),
      directVariantId && Number.isInteger(directVariantId)
        ? db
            .select({ id: productVariants.id, name: productVariants.name, addPoint: productVariants.addPoint })
            .from(productVariants)
            .where(and(eq(productVariants.id, directVariantId), eq(productVariants.isDeleted, false)))
            .limit(1)
        : Promise.resolve([undefined]),
      getPrimaryProductImagesMap([directProductId]),
    ]);
    if (prod) {
      hasPhysical = prod.type === "PHYSICAL";
      summaryItems = [
        {
          productId: prod.id,
          productName: prod.name,
          variantName: variant?.name ?? null,
          thumbnailUrl: imageMap.get(prod.id) ?? null,
          unitPoint: prod.pointPrice + (variant?.addPoint ?? 0),
          quantity: directQuantity ?? 1,
        },
      ];
    }
  } else {
    const [cart] = await db
      .select({ id: carts.id })
      .from(carts)
      .where(and(eq(carts.userId, session.userId), eq(carts.isDeleted, false)))
      .limit(1);

    if (cart) {
      const raw = await db
        .select({
          productId: cartItems.productId,
          variantId: cartItems.variantId,
          quantity: cartItems.quantity,
          productType: products.type,
          productName: products.name,
          basePoint: products.pointPrice,
        })
        .from(cartItems)
        .innerJoin(products, eq(cartItems.productId, products.id))
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.isDeleted, false)));

      hasPhysical = raw.some((r) => r.productType === "PHYSICAL");
      const productIds = Array.from(new Set(raw.map((r) => r.productId)));
      const [allVars, imageMap] = await Promise.all([
        db.select().from(productVariants).where(eq(productVariants.isDeleted, false)),
        getPrimaryProductImagesMap(productIds),
      ]);
      const varMap = new Map(allVars.map((v) => [v.id, v]));

      summaryItems = raw.map((r) => {
        const v = r.variantId ? varMap.get(r.variantId) : undefined;
        return {
          productId: r.productId,
          productName: r.productName,
          variantName: v?.name ?? null,
          thumbnailUrl: imageMap.get(r.productId) ?? null,
          unitPoint: r.basePoint + (v?.addPoint ?? 0),
          quantity: r.quantity,
        };
      });
    }
  }

  return (
    <div className="space-y-4">
      <SubPageHeader
        title="주문 · 결제"
        backHref={directProductId ? `/app/shop/products/${directProductId}` : "/app/shop/cart"}
      />
      <CheckoutClient
        walletBalance={wallet.balance}
        rechargePackages={rechargePackages}
        defaultAddress={savedAddress ?? null}
        summaryItems={summaryItems}
        hasPhysical={hasPhysical}
        directProductId={directProductId}
        directVariantId={directVariantId}
        directQuantity={directQuantity}
      />
    </div>
  );
}
