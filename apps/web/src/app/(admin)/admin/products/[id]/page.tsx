import Link from "next/link";
import { notFound } from "next/navigation";
import {
  and,
  asc,
  courses,
  desc,
  eq,
  getDb,
  orderItems,
  orders,
  productCategories,
  productImages,
  productReviews,
  products,
  productVariants,
  users,
} from "@repo/db";
import { formatDateTimeDot } from "@/00_lib/formatDate";
import { requireAdminSession } from "@/00_lib/session";
import {
  adminSoftDeleteProductAction,
  adminUpsertProductAction,
} from "@/03_actions/admin/adminCommerceActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminProductImageManager } from "@/components/admin/AdminProductImageManager";
import {
  AdminProductVariantsManager,
  type AdminVariantDraft,
} from "@/components/admin/AdminProductVariantsManager";
import {
  AdminReviewCardList,
  type AdminReviewItemView,
} from "@/components/admin/AdminReviewCardList";
import { AdminRichEditor } from "@/components/admin/AdminRichEditor";
import { AdminPageHeader } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

function parseImageUrlsField(raw: FormDataEntryValue | null): string[] {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function parseVariantsField(raw: FormDataEntryValue | null): AdminVariantDraft[] {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is Record<string, unknown> => Boolean(v && typeof v === "object"))
      .map((v) => ({
        ...(typeof v.id === "number" ? { id: v.id } : {}),
        name: String(v.name ?? "").trim(),
        addPoint: Number(v.addPoint ?? 0),
        stock: Number(v.stock ?? 0),
      }))
      .filter((v) => v.name.length > 0);
  } catch {
    return [];
  }
}

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession(["ADMIN"]);
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId)) notFound();

  const db = getDb();
  const [[prod], cats, courseList, images, variantRows, rawReviews] = await Promise.all([
    db.select().from(products).where(eq(products.id, productId)).limit(1),
    db
      .select()
      .from(productCategories)
      .where(eq(productCategories.isDeleted, false))
      .orderBy(asc(productCategories.sortOrder)),
    db.select().from(courses).where(eq(courses.isDeleted, false)).orderBy(asc(courses.sortOrder)),
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
    db
      .select({
        id: productReviews.id,
        productId: productReviews.productId,
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
      .innerJoin(users, eq(users.id, productReviews.userId))
      .innerJoin(orders, eq(orders.id, productReviews.orderId))
      .innerJoin(orderItems, eq(orderItems.id, productReviews.orderItemId))
      .where(and(eq(productReviews.productId, productId), eq(productReviews.isDeleted, false)))
      .orderBy(desc(productReviews.id)),
  ]);
  if (!prod) notFound();

  const reviewViews: AdminReviewItemView[] = rawReviews.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: prod.name,
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

  async function saveProduct(formData: FormData) {
    "use server";
    const linked = formData.get("linkedCourseId");
    return adminUpsertProductAction({
      id: productId,
      categoryId: Number(formData.get("categoryId")),
      type: String(formData.get("type")) as "PHYSICAL" | "INQUIRY_TICKET" | "PREMIUM_UNLOCK",
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      detailHtml: String(formData.get("detailHtml") ?? ""),
      imageUrls: parseImageUrlsField(formData.get("imageUrls")),
      variants: parseVariantsField(formData.get("variants")),
      pointPrice: Number(formData.get("pointPrice") ?? 0),
      stock: Number(formData.get("stock") ?? 0),
      status: String(formData.get("status")) as "ACTIVE" | "INACTIVE" | "SOLD_OUT",
      linkedCourseId: linked && String(linked) !== "" ? Number(linked) : null,
      isFeatured: formData.get("isFeatured") === "on",
    });
  }

  async function removeProduct() {
    "use server";
    return adminSoftDeleteProductAction(productId);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <AdminPageHeader
        title={`상품 상세 #${prod.id}`}
        description="이미지·요약·리치 상세정보를 수정하고 이 상품에 등록된 고객 후기를 관리합니다."
        actions={
          <>
            <Link
              href={`/app/shop/products/${prod.id}`}
              target="_blank"
              className="inline-flex h-7 items-center rounded-control px-2.5 text-control atlas-border"
            >
              사용자 화면 보기
            </Link>
            <AdminActionForm
              action={removeProduct}
              errorTitle="참조 데이터 삭제 차단"
              successMessage="상품이 소프트 삭제되었습니다."
              redirectTo="/admin/products"
            >
              <button
                type="submit"
                className="h-7 whitespace-nowrap rounded-control px-2.5 text-control text-negative atlas-border"
              >
                삭제 (주문 이력 시 차단)
              </button>
            </AdminActionForm>
          </>
        }
      />

      <AdminActionForm
        action={saveProduct}
        errorTitle="상품 수정 실패"
        successMessage="상품 정보가 저장되었습니다."
        className="space-y-5 rounded-panel bg-base-2 p-5 atlas-border"
      >
        <AdminProductImageManager
          name="imageUrls"
          initialUrls={images.map((img) => img.url)}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs text-secondary">카테고리</label>
            <select
              name="categoryId"
              defaultValue={prod.categoryId}
              className="mt-1 h-8 w-full rounded-control bg-base-1 px-2 text-xs atlas-border"
            >
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-secondary">판매 상태</label>
            <select
              name="status"
              defaultValue={prod.status}
              className="mt-1 h-8 w-full rounded-control bg-base-1 px-2 text-xs atlas-border"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SOLD_OUT">SOLD_OUT</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-secondary">상품 유형</label>
            <select
              name="type"
              defaultValue={prod.type}
              className="mt-1 h-8 w-full rounded-control bg-base-1 px-2 text-xs atlas-border"
            >
              <option value="PHYSICAL">PHYSICAL (상품 배송)</option>
              <option value="INQUIRY_TICKET">INQUIRY_TICKET (문의권)</option>
              <option value="PREMIUM_UNLOCK">PREMIUM_UNLOCK (강좌 해제)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-secondary">상품명 *</label>
          <input
            name="name"
            defaultValue={prod.name}
            className="mt-1 h-8 w-full rounded-control bg-base-1 px-2.5 text-sm atlas-border"
          />
        </div>

        <div>
          <label className="block text-xs text-secondary">상품 요약 설명</label>
          <textarea
            name="description"
            defaultValue={prod.description ?? ""}
            rows={2}
            className="mt-1 w-full rounded-control bg-base-1 p-2.5 text-xs atlas-border"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs text-secondary">포인트 가격</label>
            <input
              name="pointPrice"
              type="number"
              defaultValue={prod.pointPrice}
              className="mt-1 h-8 w-full rounded-control bg-base-1 px-2.5 font-mono text-xs atlas-border"
            />
          </div>
          <div>
            <label className="block text-xs text-secondary">재고</label>
            <input
              name="stock"
              type="number"
              defaultValue={prod.stock}
              className="mt-1 h-8 w-full rounded-control bg-base-1 px-2.5 font-mono text-xs atlas-border"
            />
          </div>
          <div>
            <label className="block text-xs text-secondary">연동 강좌</label>
            <select
              name="linkedCourseId"
              defaultValue={prod.linkedCourseId ?? ""}
              className="mt-1 h-8 w-full rounded-control bg-base-1 px-2 text-xs atlas-border"
            >
              <option value="">연동 강좌 없음</option>
              {courseList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <AdminProductVariantsManager name="variants" initialVariants={variantRows} />

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-neutral">
            상품 상세정보 (리치 에디터)
          </label>
          <AdminRichEditor name="detailHtml" initialHtml={prod.detailHtml} />
        </div>

        <div className="flex items-center justify-between pt-2 atlas-border-t">
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" name="isFeatured" defaultChecked={prod.isFeatured} /> 추천 상품
          </label>
          <button
            type="submit"
            className="h-8 rounded-control bg-inverse px-4 text-control font-medium text-on-inverse"
          >
            상품 수정 저장
          </button>
        </div>
      </AdminActionForm>

      {/* 이 상품에 등록된 고객 후기 관리 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral">
              등록된 고객 후기 ({reviewViews.length})
            </h2>
            <p className="text-xs text-subdued">
              구매 확정(CONFIRMED)된 실물 주문에서 작성된 후기입니다. 숨김 처리 및 공식 답글을 바로 관리할 수 있습니다.
            </p>
          </div>
          <Link
            href="/admin/reviews"
            className="text-xs font-medium text-info hover:underline"
          >
            전체 후기 관리 →
          </Link>
        </div>
        <AdminReviewCardList reviews={reviewViews} showProductLink={false} />
      </section>
    </div>
  );
}
