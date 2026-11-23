import { notFound } from "next/navigation";
import {
  and,
  asc,
  courseUnlocks,
  desc,
  eq,
  getDb,
  gt,
  isNull,
  or,
  orderItems,
  orders,
  productImages,
  productReviews,
  products,
  productVariants,
  users,
  userTickets,
} from "@repo/db";
import { formatDateDot } from "@/00_lib/formatDate";
import { sanitizeProductDetailHtml } from "@/00_lib/sanitizeHtml";
import { requireUserSession } from "@/00_lib/session";
import { getWalletSummary } from "@/04_services/shared/pointLedgerService";
import {
  getRechargePackagesPolicy,
  getShopReviewPolicy,
} from "@/04_services/shared/policyService";
import {
  computeReviewStats,
  maskReviewerNickname,
} from "@/04_services/shared/shopReviewService";
import { ProductBuySheetBar } from "@/components/web/ProductBuyClient";
import {
  ProductDetailTabsClient,
  ProductRatingJumpButton,
  type PublicProductReviewView,
} from "@/components/web/ProductDetailTabsClient";
import { ProductImageSwiper } from "@/components/web/ProductImageSwiper";
import type { EligibleOrderItemChoice } from "@/components/web/ProductReviewSheetForm";
import { PointBalanceRechargeStrip } from "@/components/web/SheetTriggerButtons";
import { SubPageHeader } from "@/components/web/WebUiKit";
import { AppBadge } from "@/components/web/ui";

export const dynamic = "force-dynamic";

const PRODUCT_TYPE_LABEL: Record<string, string> = {
  PHYSICAL: "상품 배송",
  PREMIUM_UNLOCK: "프리미엄 강좌 해제",
  INQUIRY_TICKET: "훈련사 문의권",
};

export default async function ShopProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireUserSession();
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId)) notFound();

  const db = getDb();
  const [[prod], wallet, rechargePackages, reviewPolicy, images, variants] = await Promise.all([
    db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.isDeleted, false)))
      .limit(1),
    getWalletSummary(session.userId),
    getRechargePackagesPolicy(),
    getShopReviewPolicy(),
    db
      .select({ url: productImages.url })
      .from(productImages)
      .where(and(eq(productImages.productId, productId), eq(productImages.isDeleted, false)))
      .orderBy(asc(productImages.sortOrder), asc(productImages.id)),
    db
      .select({
        id: productVariants.id,
        name: productVariants.name,
        addPoint: productVariants.addPoint,
        stock: productVariants.stock,
      })
      .from(productVariants)
      .where(and(eq(productVariants.productId, productId), eq(productVariants.isDeleted, false)))
      .orderBy(asc(productVariants.id)),
  ]);
  if (!prod) notFound();

  const isPhysical = prod.type === "PHYSICAL";
  const isPremiumUnlock = prod.type === "PREMIUM_UNLOCK";

  let premiumOverrideCta: { label: string; href: string } | null = null;
  if (isPremiumUnlock && prod.linkedCourseId) {
    const now = new Date();
    const [[unlocked], [ticket]] = await Promise.all([
      db
        .select({ id: courseUnlocks.id })
        .from(courseUnlocks)
        .where(
          and(
            eq(courseUnlocks.userId, session.userId),
            eq(courseUnlocks.courseId, prod.linkedCourseId),
            eq(courseUnlocks.isDeleted, false),
          ),
        )
        .limit(1),
      db
        .select({ id: userTickets.id })
        .from(userTickets)
        .where(
          and(
            eq(userTickets.userId, session.userId),
            eq(userTickets.courseId, prod.linkedCourseId),
            eq(userTickets.status, "AVAILABLE"),
            eq(userTickets.isDeleted, false),
            or(isNull(userTickets.expiresAt), gt(userTickets.expiresAt, now)),
          ),
        )
        .limit(1),
    ]);
    if (unlocked) {
      premiumOverrideCta = {
        label: "이미 잠금 해제된 강좌 · 바로 보기",
        href: `/app/courses/${prod.linkedCourseId}`,
      };
    } else if (ticket) {
      premiumOverrideCta = {
        label: "보유 티켓 있음 · 내 티켓함",
        href: "/app/my/tickets",
      };
    }
  }

  let publicReviews: PublicProductReviewView[] = [];
  let eligibleOrderItems: EligibleOrderItemChoice[] = [];
  let hasDeliveredUnconfirmed = false;

  if (isPhysical) {
    const [rawReviews, myProductOrderItems] = await Promise.all([
      db
        .select({
          id: productReviews.id,
          userId: productReviews.userId,
          orderItemId: productReviews.orderItemId,
          nickname: users.nickname,
          optionName: orderItems.nameSnap,
          rating: productReviews.rating,
          content: productReviews.content,
          imageUrls: productReviews.imageUrls,
          adminReply: productReviews.adminReply,
          adminRepliedAt: productReviews.adminRepliedAt,
          createdAt: productReviews.createdAt,
        })
        .from(productReviews)
        .innerJoin(users, eq(users.id, productReviews.userId))
        .innerJoin(orderItems, eq(orderItems.id, productReviews.orderItemId))
        .where(
          and(
            eq(productReviews.productId, prod.id),
            eq(productReviews.isDeleted, false),
            eq(productReviews.isHidden, false),
          ),
        )
        .orderBy(desc(productReviews.id))
        .limit(100),
      db
        .select({
          orderItemId: orderItems.id,
          orderNo: orders.orderNo,
          orderStatus: orders.status,
          nameSnap: orderItems.nameSnap,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(
          and(
            eq(orderItems.productId, prod.id),
            eq(orderItems.isDeleted, false),
            eq(orders.userId, session.userId),
            eq(orders.isDeleted, false),
          ),
        )
        .orderBy(desc(orders.id)),
    ]);

    // 숨김 처리된 본인 후기도 중복 작성 판별에 포함해야 정확하므로 orderItemId 전체 확인
    const myWrittenRows = await db
      .select({ orderItemId: productReviews.orderItemId })
      .from(productReviews)
      .where(
        and(
          eq(productReviews.productId, prod.id),
          eq(productReviews.userId, session.userId),
          eq(productReviews.isDeleted, false),
        ),
      );
    const myWrittenItemIds = new Set(myWrittenRows.map((r) => r.orderItemId));

    eligibleOrderItems = myProductOrderItems
      .filter((it) => it.orderStatus === "CONFIRMED" && !myWrittenItemIds.has(it.orderItemId))
      .map((it) => ({
        orderItemId: it.orderItemId,
        orderNo: it.orderNo,
        nameSnap: it.nameSnap,
      }));

    hasDeliveredUnconfirmed = myProductOrderItems.some((it) => it.orderStatus === "DELIVERED");

    publicReviews = rawReviews.map((r) => {
      const isMine = r.userId === session.userId;
      return {
        id: r.id,
        authorLabel: isMine ? r.nickname : maskReviewerNickname(r.nickname),
        isMine,
        optionName: r.optionName,
        rating: r.rating,
        content: r.content,
        imageUrls: r.imageUrls ?? [],
        adminReply: r.adminReply,
        adminRepliedAtText: r.adminRepliedAt ? formatDateDot(r.adminRepliedAt) : null,
        createdAtText: formatDateDot(r.createdAt),
      };
    });
  }

  const reviewStats = computeReviewStats(publicReviews.map((r) => r.rating));
  const safeDetailHtml = sanitizeProductDetailHtml(prod.detailHtml);

  return (
    <>
      <div className="pb-20">
        <SubPageHeader title="상품 상세" backHref="/app/shop" />

        {/* 상단 풀블리드 Peek 이미지 스와이퍼 (헤더 바로 아래 0px 밀착) */}
        <ProductImageSwiper images={images.map((i) => i.url)} productName={prod.name} />

        {/* 기본 정보 · 옵션 · Sticky 탭 본문 */}
        <div className="space-y-6 pt-5">
          <section className="border-b border-border-subtle pb-5">
            {!isPhysical && (
              <AppBadge tone="brand" size="md" className="mb-2">
                {PRODUCT_TYPE_LABEL[prod.type] ?? prod.type}
              </AppBadge>
            )}
            <h2 className="text-xl font-extrabold tracking-tight text-ink">{prod.name}</h2>

            {isPhysical && reviewStats.reviewCount > 0 && (
              <ProductRatingJumpButton
                avgRating={reviewStats.avgRating}
                reviewCount={reviewStats.reviewCount}
              />
            )}

            <p className="mt-2.5 text-2xl font-extrabold tabular-nums text-ink">
              {prod.pointPrice.toLocaleString("ko-KR")} P
            </p>
            {prod.stock <= 0 ? (
              <p className="mt-1 text-xs font-semibold text-destructive">품절된 상품입니다</p>
            ) : prod.stock <= 10 ? (
              <p className="mt-1 text-xs font-semibold tabular-nums text-warning">
                품절 임박 · {prod.stock}개 남음
              </p>
            ) : null}
            {prod.description && (
              <p className="mt-3.5 text-sm leading-relaxed text-ink-muted">{prod.description}</p>
            )}
          </section>

          <PointBalanceRechargeStrip
            walletBalance={wallet.balance}
            requiredPoint={prod.pointPrice}
            packages={rechargePackages}
          />

          {variants.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-xs font-semibold text-ink-muted">선택 가능한 옵션</h3>
              <ul className="divide-y divide-border-subtle border-y border-border-subtle">
                {variants.map((v) => {
                  const alreadyShowsPrice = /\(\+[\d,]+P\)/i.test(v.name);
                  return (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-2 py-3 text-sm text-ink"
                    >
                      <span className="font-semibold">{v.name}</span>
                      <span className="text-xs tabular-nums text-ink-muted">
                        {v.addPoint > 0 && !alreadyShowsPrice
                          ? `+${v.addPoint.toLocaleString("ko-KR")}P · `
                          : ""}
                        재고 {v.stock}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* 하단 Sticky 탭 (상품 상세 | 후기) */}
          <ProductDetailTabsClient
            productName={prod.name}
            isPhysical={isPhysical}
            detailHtml={safeDetailHtml}
            fallbackDescription={prod.description}
            reviews={publicReviews}
            stats={reviewStats}
            eligibleOrderItems={eligibleOrderItems}
            hasDeliveredUnconfirmed={hasDeliveredUnconfirmed}
            reviewPolicy={reviewPolicy}
          />
        </div>
      </div>

      <ProductBuySheetBar
        productId={prod.id}
        productName={prod.name}
        basePointPrice={prod.pointPrice}
        variants={variants}
        singleQtyOnly={isPremiumUnlock}
        overrideCta={premiumOverrideCta}
        isSoldOut={
          prod.status === "SOLD_OUT" ||
          (variants.length > 0 ? variants.every((v) => v.stock <= 0) : prod.stock <= 0)
        }
      />
    </>
  );
}
