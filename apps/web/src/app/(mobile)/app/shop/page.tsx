import { ReceiptText, ShoppingBag, ShoppingCart, Star, Ticket } from "lucide-react";
import {
  and,
  asc,
  cartItems,
  carts,
  eq,
  getDb,
  gt,
  inArray,
  isNull,
  or,
  productCategories,
  products,
  sql,
  userTickets,
} from "@repo/db";
import { WaggleMark } from "@repo/ui";
import { requireUserSession } from "@/00_lib/session";
import {
  getPrimaryProductImagesMap,
  getProductReviewSummaryMap,
} from "@/04_services/shared/shopReviewService";
import { ShopFilterControls, type ShopSortKey } from "@/components/web/ShopFilterControls";
import { EmptyStateCard } from "@/components/web/WebUiKit";
import { AppLink } from "@/components/web/ui";

export const dynamic = "force-dynamic";

const VALID_SORTS: readonly ShopSortKey[] = ["default", "price_asc", "price_desc", "reviews"];

export default async function ShopHomePage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; sort?: string }>;
}) {
  const session = await requireUserSession();
  const { cat = "all", sort = "default" } = await searchParams;
  const activeSort: ShopSortKey = VALID_SORTS.includes(sort as ShopSortKey)
    ? (sort as ShopSortKey)
    : "default";

  const db = getDb();

  const now = new Date();
  const [cats, allProducts, cartCountRows, ticketCountRows] = await Promise.all([
    db
      .select()
      .from(productCategories)
      .where(eq(productCategories.isDeleted, false))
      .orderBy(asc(productCategories.sortOrder), asc(productCategories.id)),
    db
      .select()
      .from(products)
      .where(
        and(
          inArray(products.status, ["ACTIVE", "SOLD_OUT"]),
          eq(products.isDeleted, false),
        ),
      )
      .orderBy(asc(products.sortOrder), asc(products.id)),
    db
      .select({
        totalQty: sql<string>`COALESCE(SUM(${cartItems.quantity}), 0)::text`,
      })
      .from(cartItems)
      .innerJoin(carts, eq(carts.id, cartItems.cartId))
      .where(
        and(
          eq(carts.userId, session.userId),
          eq(carts.isDeleted, false),
          eq(cartItems.isDeleted, false),
        ),
      ),
    db
      .select({ cnt: sql<string>`COUNT(*)::text` })
      .from(userTickets)
      .where(
        and(
          eq(userTickets.userId, session.userId),
          eq(userTickets.status, "AVAILABLE"),
          eq(userTickets.isDeleted, false),
          or(isNull(userTickets.expiresAt), gt(userTickets.expiresAt, now)),
        ),
      ),
  ]);

  const cartItemCount = Number(cartCountRows[0]?.totalQty ?? 0);
  const availableTicketCount = Number(ticketCountRows[0]?.cnt ?? 0);
  const productIds = allProducts.map((p) => p.id);
  const [imageMap, reviewMap] = await Promise.all([
    getPrimaryProductImagesMap(productIds),
    getProductReviewSummaryMap(productIds),
  ]);

  const filtered =
    cat === "all" ? allProducts : allProducts.filter((p) => String(p.categoryId) === cat);

  const sorted = [...filtered].sort((a, b) => {
    if (activeSort === "price_asc") return a.pointPrice - b.pointPrice;
    if (activeSort === "price_desc") return b.pointPrice - a.pointPrice;
    if (activeSort === "reviews") {
      const ca = reviewMap.get(a.id)?.count ?? 0;
      const cb = reviewMap.get(b.id)?.count ?? 0;
      return cb - ca || a.sortOrder - b.sortOrder;
    }
    return a.sortOrder - b.sortOrder || a.id - b.id;
  });

  return (
    <div className="waggle-stagger flex flex-1 flex-col space-y-4">
      <section className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-ink">
          <ShoppingBag className="size-5 shrink-0 text-brand" strokeWidth={2.2} />
          포인트샵
        </h1>
        <div className="flex items-center gap-0.5">
          <AppLink
            href="/app/my/tickets"
            aria-label={
              availableTicketCount > 0 ? `내 티켓함 (${availableTicketCount}장)` : "내 티켓함"
            }
            title="내 티켓함"
            className="relative flex size-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-subtle active:scale-95"
          >
            <Ticket className="size-5" strokeWidth={1.85} />
            {availableTicketCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-2xs font-bold leading-none tabular-nums text-surface">
                {availableTicketCount > 99 ? "99+" : availableTicketCount}
              </span>
            )}
          </AppLink>
          <AppLink
            href="/app/shop/orders"
            aria-label="주문내역"
            title="주문내역"
            className="flex size-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-subtle active:scale-95"
          >
            <ReceiptText className="size-5" strokeWidth={1.85} />
          </AppLink>
          <AppLink
            href="/app/shop/cart"
            aria-label={cartItemCount > 0 ? `장바구니 (${cartItemCount}개)` : "장바구니"}
            title="장바구니"
            className="relative flex size-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-subtle active:scale-95"
          >
            <ShoppingCart className="size-5" strokeWidth={1.85} />
            {cartItemCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-2xs font-bold leading-none tabular-nums text-surface">
                {cartItemCount > 99 ? "99+" : cartItemCount}
              </span>
            )}
          </AppLink>
        </div>
      </section>

      <ShopFilterControls
        categories={cats.map((c) => ({ id: String(c.id), name: c.name }))}
        activeCat={cat}
        activeSort={activeSort}
        totalCount={sorted.length}
      />

      {sorted.length === 0 ? (
        <EmptyStateCard
          mode="page"
          icon={<ShoppingBag className="size-5.5" strokeWidth={1.7} />}
          title="등록된 상품이 없습니다"
          description="다른 카테고리를 선택해 보세요."
          ctaLabel="전체 상품 보기"
          ctaHref="/app/shop"
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6">
          {sorted.map((prod) => {
            const thumb = imageMap.get(prod.id);
            const rev = reviewMap.get(prod.id);
            const isSoldOut = prod.status === "SOLD_OUT" || prod.stock <= 0;
            const specialBadgeLabel =
              prod.type === "PREMIUM_UNLOCK"
                ? "강좌 해제"
                : prod.type === "INQUIRY_TICKET"
                  ? "문의권"
                  : null;

            return (
              <AppLink
                key={prod.id}
                href={`/app/shop/products/${prod.id}`}
                className="group flex flex-col transition-transform duration-150 active:scale-[0.98]"
              >
                {/* 상품 썸네일 (이미지 미등록 시 Primary 컬러 + 중앙 WaggleMark) */}
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-surface-subtle">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={prod.name}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-brand">
                      <WaggleMark className="w-[40%] text-surface/95" />
                    </div>
                  )}

                  {/* 특수 디지털 상품만 좌상단 배지 표시 (일반 배송 상품은 이미지 깔끔하게 유지) */}
                  {specialBadgeLabel && (
                    <span className="absolute left-2 top-2 rounded-lg bg-surface/90 px-2 py-0.5 text-2xs font-bold text-ink backdrop-blur-xs">
                      {specialBadgeLabel}
                    </span>
                  )}

                  {/* 품절 오버레이 */}
                  {isSoldOut && (
                    <div className="absolute inset-0 flex items-center justify-center bg-ink/55 backdrop-blur-[1px]">
                      <span className="rounded-xl bg-surface px-3 py-1 text-xs font-extrabold text-ink">
                        품절
                      </span>
                    </div>
                  )}
                </div>

                {/* 하단 상품 정보 */}
                <div className="mt-2.5 flex flex-1 flex-col">
                  <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
                    {prod.name}
                  </h2>

                  <p className="mt-1.5 text-base font-extrabold tracking-tight tabular-nums text-ink">
                    {prod.pointPrice.toLocaleString("ko-KR")} P
                  </p>

                  {prod.type === "PHYSICAL" && rev && rev.count > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                      <Star
                        className="size-3 fill-star text-star"
                        strokeWidth={1.8}
                      />
                      <span className="font-bold tabular-nums text-ink">
                        {rev.avgRating.toFixed(1)}
                      </span>
                      <span className="tabular-nums">({rev.count})</span>
                    </div>
                  )}
                </div>
              </AppLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
