import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { asc, eq, getDb, productCategories, products } from "@repo/db";
import { WaggleMark } from "@repo/ui";
import { toAdminUploadUrl } from "@/00_lib/mediaUrl";
import { requireAdminSession } from "@/00_lib/session";
import {
  getPrimaryProductImagesMap,
  getProductReviewSummaryMap,
} from "@/04_services/shared/shopReviewService";
import {
  adminButtonClass,
  AdminPageHeader,
  AdminStatusBadge,
} from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requireAdminSession(["ADMIN"]);
  const db = getDb();

  const [list, cats] = await Promise.all([
    db.select().from(products).where(eq(products.isDeleted, false)).orderBy(asc(products.sortOrder)),
    db.select().from(productCategories).where(eq(productCategories.isDeleted, false)),
  ]);
  const productIds = list.map((p) => p.id);
  const [imageMap, reviewMap] = await Promise.all([
    getPrimaryProductImagesMap(productIds),
    getProductReviewSummaryMap(productIds),
  ]);
  const catMap = new Map(cats.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="포인트샵 상품 관리"
        description="실물 제휴 상품 · 프리미엄 강좌 잠금해제 · 훈련사 문의권 (이미지 · 리치 상세 · 후기 연동)"
        actions={
          <>
            <Link
              href="/admin/reviews"
              className={adminButtonClass({ variant: "outline", size: "sm" })}
            >
              상품 후기 관리
            </Link>
            <Link
              href="/admin/products/categories"
              className={adminButtonClass({ variant: "outline", size: "sm" })}
            >
              카테고리 관리
            </Link>
            <Link
              href="/admin/products/new"
              className={adminButtonClass({ variant: "solid", size: "sm" })}
            >
              <Plus className="size-3.5 stroke-[1.5]" aria-hidden="true" />
              상품 등록
            </Link>
          </>
        }
      />

      <div className="overflow-x-auto rounded-panel bg-base-1 atlas-border">
        <table className="w-full min-w-full text-left">
          <thead>
            <tr className="h-9 bg-base-2 text-xs text-secondary atlas-border-b">
              <th className="py-2 pl-4 pr-3 whitespace-nowrap">ID</th>
              <th className="px-3 py-2 whitespace-nowrap">이미지</th>
              <th className="px-3 py-2 whitespace-nowrap">카테고리</th>
              <th className="px-3 py-2 whitespace-nowrap min-w-44">상품명</th>
              <th className="px-3 py-2 whitespace-nowrap">유형</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">포인트가</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">재고</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">후기 · 평점</th>
              <th className="py-2 pl-3 pr-4 text-right whitespace-nowrap">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline text-sm">
            {list.map((p) => {
              const thumb = imageMap.get(p.id);
              const rev = reviewMap.get(p.id);
              return (
                <tr key={p.id} className="hover:bg-[var(--mix-table-hover)]">
                  <td className="py-2.5 pl-4 pr-3 font-mono text-xs whitespace-nowrap text-secondary">
                    #{p.id}
                  </td>
                  <td className="px-3 py-2">
                    {thumb ? (
                      <div className="size-10 overflow-hidden rounded-btn-sm bg-base-2 atlas-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={toAdminUploadUrl(thumb)} alt={p.name} className="size-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-btn-sm bg-positive/15 text-positive atlas-border">
                        <WaggleMark className="h-4 w-auto" />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap text-secondary">
                    {catMap.get(p.categoryId) ?? "-"}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="font-medium text-info hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{p.type}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                    {p.pointPrice.toLocaleString("ko-KR")} P
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                    {p.stock}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                    {p.type === "PHYSICAL" ? (
                      rev && rev.count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-neutral">
                          <Star className="size-3 fill-current text-star" />
                          {rev.avgRating.toFixed(1)} ({rev.count})
                        </span>
                      ) : (
                        <span className="text-subdued">0건</span>
                      )
                    ) : (
                      <span className="text-subdued">-</span>
                    )}
                  </td>
                  <td className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">
                    <AdminStatusBadge tone={p.status === "ACTIVE" ? "positive" : "warning"}>
                      {p.status}
                    </AdminStatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
