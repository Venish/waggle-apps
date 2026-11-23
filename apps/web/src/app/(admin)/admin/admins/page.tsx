import Link from "next/link";
import { Plus } from "lucide-react";
import { admins, desc, eq, getDb } from "@repo/db";
import { requireAdminSession } from "@/00_lib/session";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  await requireAdminSession(["ADMIN"]);
  const db = getDb();
  const list = await db
    .select()
    .from(admins)
    .where(eq(admins.isDeleted, false))
    .orderBy(desc(admins.id));

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="관리자 계정 관리"
        description="운영자(ADMIN) 및 훈련사(TRAINER) 2FA 계정 목록"
        actions={
          <Link
            href="/admin/admins/new"
            className="inline-flex h-7 items-center gap-1.5 rounded-control bg-inverse px-2.5 text-control font-medium text-on-inverse"
          >
            <Plus className="size-3.5" strokeWidth={1.75} />
            관리자 등록
          </Link>
        }
      />

      <div className="overflow-x-auto rounded-panel bg-base-1 atlas-border">
        <table className="w-full min-w-full text-left">
          <thead>
            <tr className="h-9 bg-base-2 text-xs font-medium text-secondary atlas-border-b">
              <th className="py-2 pl-4 pr-3 whitespace-nowrap">ID</th>
              <th className="px-3 py-2 whitespace-nowrap">이메일</th>
              <th className="px-3 py-2 whitespace-nowrap">이름</th>
              <th className="px-3 py-2 whitespace-nowrap">역할</th>
              <th className="px-3 py-2 whitespace-nowrap">상태</th>
              <th className="py-2 pl-3 pr-4 text-right whitespace-nowrap">오답 횟수</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline text-sm">
            {list.map((a) => (
              <tr key={a.id} className="hover:bg-[var(--mix-table-hover)]">
                <td className="py-2.5 pl-4 pr-3 font-mono text-xs whitespace-nowrap tabular-nums text-secondary">
                  #{a.id}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <Link href={`/admin/admins/${a.id}`} className="font-medium text-info hover:underline">
                    {a.email}
                  </Link>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{a.name}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <AdminStatusBadge tone={a.role === "ADMIN" ? "info" : "neutral"}>
                    {a.role}
                  </AdminStatusBadge>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <AdminStatusBadge
                    tone={
                      a.status === "ACTIVE"
                        ? "positive"
                        : a.status === "LOCKED"
                          ? "negative"
                          : "warning"
                    }
                  >
                    {a.status}
                  </AdminStatusBadge>
                </td>
                <td className="py-2.5 pl-3 pr-4 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                  {a.failedLoginCount} / 5
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
