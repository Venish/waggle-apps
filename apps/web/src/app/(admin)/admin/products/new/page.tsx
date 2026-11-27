import { asc, courses, eq, getDb, productCategories } from "@repo/db";
import { requireAdminSession } from "@/00_lib/session";
import { adminUpsertProductAction } from "@/03_actions/admin/adminCommerceActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminProductImageManager } from "@/components/admin/AdminProductImageManager";
import {
  AdminProductVariantsManager,
  type AdminVariantDraft,
} from "@/components/admin/AdminProductVariantsManager";
import { AdminRichEditor } from "@/components/admin/AdminRichEditor";
import {
  AdminInput,
  AdminPageHeader,
  AdminSelect,
  AdminTextarea,
} from "@/components/admin/AdminUiKit";

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

export default async function AdminProductNewPage() {
  await requireAdminSession(["ADMIN"]);
  const db = getDb();
  const [cats, courseList] = await Promise.all([
    db
      .select()
      .from(productCategories)
      .where(eq(productCategories.isDeleted, false))
      .orderBy(asc(productCategories.sortOrder)),
    db.select().from(courses).where(eq(courses.isDeleted, false)).orderBy(asc(courses.sortOrder)),
  ]);

  async function createProduct(formData: FormData) {
    "use server";
    const linked = formData.get("linkedCourseId");
    return adminUpsertProductAction({
      categoryId: Number(formData.get("categoryId")),
      type: String(formData.get("type") ?? "PHYSICAL") as
        | "PHYSICAL"
        | "INQUIRY_TICKET"
        | "PREMIUM_UNLOCK",
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      detailHtml: String(formData.get("detailHtml") ?? ""),
      imageUrls: parseImageUrlsField(formData.get("imageUrls")),
      variants: parseVariantsField(formData.get("variants")),
      pointPrice: Number(formData.get("pointPrice") ?? 0),
      stock: Number(formData.get("stock") ?? 0),
      status: "ACTIVE",
      linkedCourseId: linked && String(linked) !== "" ? Number(linked) : null,
      isFeatured: formData.get("isFeatured") === "on",
    });
  }

  return (
    <div className="max-w-4xl space-y-4">
      <AdminPageHeader
        title="포인트샵 상품 신규 등록"
        description="상품 다중 이미지, 요약 설명, 리치 상세정보(HTML 에디터)를 함께 등록합니다."
      />
      <AdminActionForm
        action={createProduct}
        errorTitle="상품 등록 실패"
        successMessage="상품이 등록되었습니다."
        redirectIdPrefix="/admin/products"
        className="space-y-5 rounded-panel bg-base-2 p-5 atlas-border"
      >
        <AdminProductImageManager name="imageUrls" initialUrls={[]} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-secondary">카테고리</label>
            <AdminSelect
              name="categoryId"
              defaultValue={String(cats[0]?.id ?? "")}
              ariaLabel="카테고리"
              size="md"
              className="mt-1"
              options={cats.map((c) => ({ value: String(c.id), label: c.name }))}
            />
          </div>
          <div>
            <label className="block text-xs text-secondary">상품 유형</label>
            <AdminSelect
              name="type"
              defaultValue="PHYSICAL"
              ariaLabel="상품 유형"
              size="md"
              className="mt-1"
              options={[
                { value: "PHYSICAL", label: "PHYSICAL (상품 배송 · 후기 지원)" },
                { value: "INQUIRY_TICKET", label: "INQUIRY_TICKET (문의권)" },
                { value: "PREMIUM_UNLOCK", label: "PREMIUM_UNLOCK (강좌 해제)" },
              ]}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-secondary">상품명 *</label>
          <AdminInput name="name" size="md" className="mt-1" />
        </div>

        <div>
          <label className="block text-xs text-secondary">상품 요약 설명 (상단 노출)</label>
          <AdminTextarea
            name="description"
            rows={2}
            placeholder="상품명 아래에 노출되는 1~2줄 핵심 설명"
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs text-secondary">포인트 가격 *</label>
            <AdminInput
              name="pointPrice"
              type="number"
              size="md"
              min={0}
              defaultValue={1000}
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-secondary">초기 재고 *</label>
            <AdminInput
              name="stock"
              type="number"
              size="md"
              min={0}
              defaultValue={50}
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-secondary">연동 강좌 (PREMIUM_UNLOCK 전용)</label>
            <AdminSelect
              name="linkedCourseId"
              defaultValue=""
              ariaLabel="연동 강좌"
              size="md"
              className="mt-1"
              options={[
                { value: "", label: "연동 없음" },
                ...courseList.map((c) => ({ value: String(c.id), label: c.title })),
              ]}
            />
          </div>
        </div>

        <AdminProductVariantsManager name="variants" initialVariants={[]} />

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-neutral">
            상품 상세정보 (리치 에디터 — 상세 탭에 노출)
          </label>
          <AdminRichEditor name="detailHtml" initialHtml="" />
        </div>

        <div className="flex items-center justify-between pt-2 atlas-border-t">
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" name="isFeatured" /> 추천 상품 노출
          </label>
          <button
            type="submit"
            className="h-8 rounded-control bg-inverse px-4 text-control font-medium text-on-inverse"
          >
            상품 등록
          </button>
        </div>
      </AdminActionForm>
    </div>
  );
}
