import Link from "next/link";
import { desc, eq, getDb, orderItems, orders, productReviews, products, users } from "@repo/db";
import { formatDateTimeDot } from "@/00_lib/formatDate";
import { requireAdminSession } from "@/00_lib/session";
import { adminUpdateShopReviewPoliciesAction } from "@/03_actions/admin/adminCommerceActions";
import { getShopReviewPolicy } from "@/04_services/shared/policyService";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import {
  AdminReviewCardList,
  type AdminReviewItemView,
} from "@/components/admin/AdminReviewCardList";
import { AdminPageHeader } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

type ReviewTab = "ALL" | "UNREPLIED" | "PHOTO" | "HIDDEN";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdminSession(["ADMIN"]);
  const { tab = "ALL" } = await searchParams;
  const activeTab = (
    ["ALL", "UNREPLIED", "PHOTO", "HIDDEN"].includes(tab) ? tab : "ALL"
  ) as ReviewTab;

  const db = getDb();
  const [policy, rawReviews] = await Promise.all([
    getShopReviewPolicy(),
    db
      .select({
        id: productReviews.id,
        productId: productReviews.productId,
        productName: products.name,
        userId: productReviews.userId,
        userNickname: users.nickname,
        orderNo: orders.orderNo,
        orderItemName: orderItems.nameSnap,
        rating: productReviews.rating,
        content: productReviews.content,
        imageUrls: productReviews.imageUrls,
        rewardPoint: productReviews.rewardPoint,
        isHidden: productReviews.isHidden,
        adminReply: productReviews.adminReply,
        adminRepliedAt: productReviews.adminRepliedAt,
        createdAt: productReviews.createdAt,
      })
      .from(productReviews)
      .innerJoin(products, eq(products.id, productReviews.productId))
      .innerJoin(users, eq(users.id, productReviews.userId))
      .innerJoin(orders, eq(orders.id, productReviews.orderId))
      .innerJoin(orderItems, eq(orderItems.id, productReviews.orderItemId))
      .where(eq(productReviews.isDeleted, false))
      .orderBy(desc(productReviews.id))
      .limit(100),
  ]);

  const allViews: AdminReviewItemView[] = rawReviews.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.productName,
    userId: r.userId,
    userNickname: r.userNickname,
    orderNo: r.orderNo,
    orderItemName: r.orderItemName,
    rating: r.rating,
    content: r.content,
    imageUrls: r.imageUrls ?? [],
    rewardPoint: r.rewardPoint,
    isHidden: r.isHidden,
    adminReply: r.adminReply,
    adminRepliedAtText: r.adminRepliedAt ? formatDateTimeDot(r.adminRepliedAt) : null,
    createdAtText: formatDateTimeDot(r.createdAt),
  }));

  const unrepliedCount = allViews.filter((r) => !r.adminReply).length;
  const photoCount = allViews.filter((r) => r.imageUrls.length > 0).length;
  const hiddenCount = allViews.filter((r) => r.isHidden).length;

  const filtered = allViews.filter((r) => {
    if (activeTab === "UNREPLIED") return !r.adminReply;
    if (activeTab === "PHOTO") return r.imageUrls.length > 0;
    if (activeTab === "HIDDEN") return r.isHidden;
    return true;
  });

  async function saveReviewPolicy(formData: FormData) {
    "use server";
    return adminUpdateShopReviewPoliciesAction({
      textRewardPoint: Number(formData.get("textRewardPoint") ?? 0),
      photoRewardPoint: Number(formData.get("photoRewardPoint") ?? 0),
      minLength: Number(formData.get("minLength") ?? 20),
      maxLength: Number(formData.get("maxLength") ?? 500),
    });
  }

  const tabs: Array<{ key: ReviewTab; label: string }> = [
    { key: "ALL", label: `전체 (${allViews.length})` },
    { key: "UNREPLIED", label: `미답변 (${unrepliedCount})` },
    { key: "PHOTO", label: `포토 후기 (${photoCount})` },
    { key: "HIDDEN", label: `숨김 처리 (${hiddenCount})` },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="상품 후기 관리"
        description="구매 확정(CONFIRMED) 실물 상품 후기 검수 · 공식 답글 · 블라인드 및 적립 포인트 정책 설정"
      />

      {/* 후기 적립 포인트 · 글자수 빠른 설정 */}
      <AdminActionForm
        action={saveReviewPolicy}
        errorTitle="후기 정책 저장 실패"
        successMessage="후기 적립 포인트 및 글자수 정책이 저장되었습니다."
        className="space-y-3 rounded-panel bg-base-2 p-4 atlas-border"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold text-neutral">후기 적립 포인트 · 글자수 정책 (policy_configs)</h2>
            <p className="text-xs text-subdued">
              적립 금액을 0으로 설정하면 포인트 미지급으로 동작합니다. 변경 내역은 정책 이력에 자동 기록됩니다.
            </p>
          </div>
          <Link href="/admin/policies" className="text-xs text-info hover:underline">
            전체 정책 설정 →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 items-end">
          <div>
            <label className="block text-xs text-secondary">텍스트 후기 적립 (P)</label>
            <input
              name="textRewardPoint"
              type="number"
              min={0}
              defaultValue={policy.textRewardPoint}
              className="mt-1 h-7 w-full rounded-control bg-base-1 px-2.5 font-mono text-xs tabular-nums atlas-border"
            />
          </div>
          <div>
            <label className="block text-xs text-secondary">포토 후기 적립 (P)</label>
            <input
              name="photoRewardPoint"
              type="number"
              min={0}
              defaultValue={policy.photoRewardPoint}
              className="mt-1 h-7 w-full rounded-control bg-base-1 px-2.5 font-mono text-xs tabular-nums atlas-border"
            />
          </div>
          <div>
            <label className="block text-xs text-secondary">최소 글자수</label>
            <input
              name="minLength"
              type="number"
              min={5}
              defaultValue={policy.minLength}
              className="mt-1 h-7 w-full rounded-control bg-base-1 px-2.5 font-mono text-xs tabular-nums atlas-border"
            />
          </div>
          <div>
            <label className="block text-xs text-secondary">최대 글자수</label>
            <input
              name="maxLength"
              type="number"
              min={50}
              defaultValue={policy.maxLength}
              className="mt-1 h-7 w-full rounded-control bg-base-1 px-2.5 font-mono text-xs tabular-nums atlas-border"
            />
          </div>
          <button
            type="submit"
            className="h-7 rounded-control bg-inverse px-3 text-xs font-medium text-on-inverse"
          >
            정책 저장
          </button>
        </div>
      </AdminActionForm>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <Link
              key={t.key}
              href={t.key === "ALL" ? "/admin/reviews" : `/admin/reviews?tab=${t.key}`}
              className={`inline-flex h-7 items-center rounded-control px-2.5 text-xs font-medium transition-colors atlas-border ${
                active
                  ? "bg-inverse text-on-inverse"
                  : "bg-base-2 text-secondary hover:text-neutral"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <AdminReviewCardList reviews={filtered} showProductLink />
    </div>
  );
}
