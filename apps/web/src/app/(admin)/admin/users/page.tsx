import Link from "next/link";
import { accounts, desc, eq, getDb, pointWallets, users } from "@repo/db";
import { formatDateDot } from "@/00_lib/formatDate";
import { requireAdminSession } from "@/00_lib/session";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireAdminSession(["ADMIN"]);
  const { q = "", status = "ALL" } = await searchParams;
  const db = getDb();

  const rows = await db
    .select({
      id: users.id,
      nickname: users.nickname,
      phone: users.phone,
      status: users.status,
      email: accounts.email,
      provider: accounts.provider,
      balance: pointWallets.balance,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(accounts, eq(users.accountId, accounts.id))
    .leftJoin(pointWallets, eq(pointWallets.userId, users.id))
    .where(eq(users.isDeleted, false))
    .orderBy(desc(users.id));

  const trimmed = q.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (status !== "ALL" && r.status !== status) return false;
    if (!trimmed) return true;
    return (
      r.nickname.toLowerCase().includes(trimmed) ||
      (r.email ?? "").toLowerCase().includes(trimmed)
    );
  });

  return (
    <div className="space-y-4">
      <AdminPageHeader title="보호자 회원 관리" description="전체 보호자 목록 및 다중 필터" />

      <form className="flex flex-wrap items-center gap-2 rounded-panel bg-base-2 p-3 atlas-border">
        <input
          name="q"
          defaultValue={q}
          placeholder="닉네임 · 이메일 검색..."
          className="h-7 min-w-0 flex-1 sm:flex-none sm:w-60 rounded-control bg-base-1 px-2.5 text-sm atlas-border"
        />
        <select
          name="status"
          defaultValue={status}
          className="h-7 shrink-0 rounded-control bg-base-1 px-2.5 text-control atlas-border"
        >
          <option value="ALL">상태 전체</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
        <button type="submit" className="h-7 shrink-0 whitespace-nowrap rounded-control bg-inverse px-3 text-control font-medium text-on-inverse">
          필터 적용
        </button>
      </form>

      <div className="overflow-x-auto rounded-panel bg-base-1 atlas-border">
        <table className="w-full min-w-full text-left">
          <thead>
            <tr className="h-9 bg-base-2 text-xs font-medium text-secondary atlas-border-b">
              <th className="py-2 pl-4 pr-3 whitespace-nowrap">ID</th>
              <th className="px-3 py-2 whitespace-nowrap">닉네임</th>
              <th className="px-3 py-2 whitespace-nowrap">이메일 / 채널</th>
              <th className="px-3 py-2 whitespace-nowrap">상태</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">보유 포인트</th>
              <th className="py-2 pl-3 pr-4 text-right whitespace-nowrap">가입일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline text-sm">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-[var(--mix-table-hover)]">
                <td className="py-2.5 pl-4 pr-3 font-mono text-xs whitespace-nowrap tabular-nums text-secondary">#{u.id}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-info hover:underline">
                    {u.nickname}
                  </Link>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap text-secondary">
                  {u.email ?? "-"} ({u.provider})
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <AdminStatusBadge tone={u.status === "ACTIVE" ? "positive" : "negative"}>
                    {u.status}
                  </AdminStatusBadge>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-sm whitespace-nowrap tabular-nums">
                  {(u.balance ?? 0).toLocaleString("ko-KR")} P
                </td>
                <td className="py-2.5 pl-3 pr-4 text-right font-mono text-xs whitespace-nowrap tabular-nums text-subdued">
                  {formatDateDot(u.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
