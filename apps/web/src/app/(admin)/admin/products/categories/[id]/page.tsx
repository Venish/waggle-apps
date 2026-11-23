import { notFound } from "next/navigation";
import { eq, getDb, productCategories } from "@repo/db";
import { requireAdminSession } from "@/00_lib/session";
import {
  adminSoftDeleteCategoryAction,
  adminUpsertCategoryAction,
} from "@/03_actions/admin/adminCommerceActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminProductCategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession(["ADMIN"]);
  const { id } = await params;
  const catId = Number(id);
  if (!Number.isInteger(catId)) notFound();

  const db = getDb();
  const [cat] = await db.select().from(productCategories).where(eq(productCategories.id, catId)).limit(1);
  if (!cat) notFound();

  async function save(formData: FormData) {
    "use server";
    return adminUpsertCategoryAction({
      id: catId,
      code: String(formData.get("code") ?? cat!.code),
      name: String(formData.get("name") ?? cat!.name),
      sortOrder: Number(formData.get("sortOrder") ?? cat!.sortOrder),
    });
  }

  async function removeCategory() {
    "use server";
    return adminSoftDeleteCategoryAction(catId);
  }

  return (
    <div className="max-w-md space-y-4">
      <AdminPageHeader
        title={`카테고리 수정 #${cat.id}`}
        actions={
          <AdminActionForm
            action={removeCategory}
            errorTitle="참조 데이터 삭제 차단"
            successMessage="카테고리가 소프트 삭제되었습니다."
            redirectTo="/admin/products/categories"
          >
            <button type="submit" className="h-7 rounded-control px-2.5 text-control text-negative atlas-border">
              삭제 (상품 연결 시 차단)
            </button>
          </AdminActionForm>
        }
      />
      <AdminActionForm
        action={save}
        errorTitle="카테고리 수정 실패"
        successMessage="카테고리가 수정되었습니다."
        redirectTo="/admin/products/categories"
        className="space-y-3 rounded-panel bg-base-2 p-5 atlas-border"
      >
        <input name="code" defaultValue={cat.code} className="h-7 w-full rounded-control bg-base-1 px-2.5 font-mono text-xs atlas-border" />
        <input name="name" defaultValue={cat.name} className="h-7 w-full rounded-control bg-base-1 px-2.5 text-sm atlas-border" />
        <input name="sortOrder" type="number" defaultValue={cat.sortOrder} className="h-7 w-full rounded-control bg-base-1 px-2.5 font-mono text-xs atlas-border" />
        <button type="submit" className="h-7 rounded-control bg-inverse px-3 text-control font-medium text-on-inverse">
          수정 저장
        </button>
      </AdminActionForm>
    </div>
  );
}
