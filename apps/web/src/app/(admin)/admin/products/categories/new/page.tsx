import { requireAdminSession } from "@/00_lib/session";
import { adminUpsertCategoryAction } from "@/03_actions/admin/adminCommerceActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminProductCategoryNewPage() {
  await requireAdminSession(["ADMIN"]);

  async function save(formData: FormData) {
    "use server";
    return adminUpsertCategoryAction({
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      sortOrder: Number(formData.get("sortOrder") ?? 10),
    });
  }

  return (
    <div className="max-w-md space-y-4">
      <AdminPageHeader title="상품 카테고리 신규 등록" />
      <AdminActionForm
        action={save}
        errorTitle="카테고리 등록 실패"
        successMessage="카테고리가 등록되었습니다."
        redirectTo="/admin/products/categories"
        className="space-y-3 rounded-panel bg-base-2 p-5 atlas-border"
      >
        <input name="code" placeholder="카테고리 코드 (예: TOY)" className="h-7 w-full rounded-control bg-base-1 px-2.5 font-mono text-xs atlas-border" />
        <input name="name" placeholder="카테고리명" className="h-7 w-full rounded-control bg-base-1 px-2.5 text-sm atlas-border" />
        <input name="sortOrder" type="number" defaultValue={10} className="h-7 w-full rounded-control bg-base-1 px-2.5 font-mono text-xs atlas-border" />
        <button type="submit" className="h-7 rounded-control bg-inverse px-3 text-control font-medium text-on-inverse">
          저장
        </button>
      </AdminActionForm>
    </div>
  );
}
