import Link from "next/link";
import { Plus } from "lucide-react";
import { asc, eq, getDb, productCategories } from "@repo/db";
import { requireAdminSession } from "@/00_lib/session";
import { AdminPageHeader } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminProductCategoriesPage() {
  await requireAdminSession(["ADMIN"]);
  const db = getDb();
  const list = await db
    .select()
    .from(productCategories)
    .where(eq(productCategories.isDeleted, false))
    .orderBy(asc(productCategories.sortOrder));

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="상품 카테고리 관리"
        actions={
          <Link href="/admin/products/categories/new" className="inline-flex h-7 items-center gap-1 rounded-control bg-inverse px-2.5 text-control font-medium text-on-inverse">
            <Plus className="size-3.5" strokeWidth={1.75} />
            카테고리 등록
          </Link>
        }
      />

      <div className="overflow-x-auto rounded-panel bg-base-1 atlas-border">
        <table className="w-full min-w-full text-left">
          <thead>
            <tr className="h-9 bg-base-2 text-xs text-secondary atlas-border-b">
              <th className="py-2 pl-4 pr-3">코드</th>
              <th className="px-3 py-2">카테고리명</th>
              <th className="py-2 pl-3 pr-4 text-right">정렬</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline text-sm">
            {list.map((c) => (
              <tr key={c.id} className="hover:bg-[var(--mix-table-hover)]">
                <td className="py-2.5 pl-4 pr-3 font-mono text-xs text-secondary">{c.code}</td>
                <td className="px-3 py-2.5">
                  <Link href={`/admin/products/categories/${c.id}`} className="font-medium text-info hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="py-2.5 pl-3 pr-4 text-right font-mono text-xs tabular-nums">{c.sortOrder}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
