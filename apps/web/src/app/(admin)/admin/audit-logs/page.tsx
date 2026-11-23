import Link from "next/link";
import { auditLogs, desc, eq, getDb } from "@repo/db";
import { formatDateTimeDot } from "@/00_lib/formatDate";
import { requireAdminSession } from "@/00_lib/session";
import { adminRestoreEntityAction } from "@/03_actions/admin/adminTrainerOpsActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  await requireAdminSession(["ADMIN"]);
  const { mode = "all" } = await searchParams;
  const db = getDb();

  const [logs, restoreLogs] = await Promise.all([
    mode === "deleted"
      ? db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.action, "entity.soft_delete"))
          .orderBy(desc(auditLogs.id))
          .limit(50)
      : db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(80),
    db
      .select({
        id: auditLogs.id,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
      })
      .from(auditLogs)
      .where(eq(auditLogs.action, "entity.restore"))
      .orderBy(desc(auditLogs.id))
      .limit(200),
  ]);

  const latestRestoreIdByKey = new Map<string, number>();
  for (const r of restoreLogs) {
    if (!r.entity || !r.entityId) continue;
    const key = `${r.entity}:${r.entityId}`;
    if (!latestRestoreIdByKey.has(key)) {
      latestRestoreIdByKey.set(key, r.id);
    }
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="전역 감사로그 · 삭제 이력 / 원클릭 복원"
        description="물리 DELETE 금지 규약: 모든 소프트 삭제 건을 이곳에서 원클릭 복원합니다."
        actions={
          <div className="flex flex-wrap gap-1.5">
            <Link
              href="/admin/audit-logs?mode=all"
              className={`inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-control px-2.5 text-xs font-medium ${
                mode === "all" ? "bg-inverse text-on-inverse" : "text-secondary atlas-border"
              }`}
            >
              전체 로그
            </Link>
            <Link
              href="/admin/audit-logs?mode=deleted"
              className={`inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-control px-2.5 text-xs font-medium ${
                mode === "deleted" ? "bg-inverse text-on-inverse" : "text-secondary atlas-border"
              }`}
            >
              삭제 이력 / 복원 전용
            </Link>
          </div>
        }
      />

      <div className="overflow-x-auto rounded-panel bg-base-1 atlas-border">
        <table className="w-full min-w-full text-left">
          <thead>
            <tr className="h-9 bg-base-2 text-xs text-secondary atlas-border-b">
              <th className="py-2 pl-4 pr-3 whitespace-nowrap">시각</th>
              <th className="px-3 py-2 whitespace-nowrap">액션</th>
              <th className="px-3 py-2 whitespace-nowrap">엔티티</th>
              <th className="px-3 py-2 whitespace-nowrap">행위자</th>
              <th className="py-2 pl-3 pr-4 text-right whitespace-nowrap">복원</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline text-xs">
            {logs.map((log) => {
              const key = log.entity && log.entityId ? `${log.entity}:${log.entityId}` : null;
              const isRestored =
                log.action === "entity.soft_delete" &&
                key !== null &&
                (latestRestoreIdByKey.get(key) ?? 0) > log.id;

              async function restore() {
                "use server";
                if (!log.entity || !log.entityId) {
                  return {
                    ok: false as const,
                    error: { code: "VALIDATION_ERROR" as const, message: "복원 대상 정보가 없습니다." },
                  };
                }
                return adminRestoreEntityAction({ entity: log.entity, entityId: log.entityId });
              }

              return (
                <tr key={log.id} className="hover:bg-[var(--mix-table-hover)]">
                  <td className="py-2.5 pl-4 pr-3 font-mono whitespace-nowrap tabular-nums text-subdued">
                    {formatDateTimeDot(log.createdAt, { seconds: true })}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <AdminStatusBadge
                      tone={
                        log.action === "entity.soft_delete"
                          ? "negative"
                          : log.action === "entity.restore"
                            ? "positive"
                            : "info"
                      }
                    >
                      {log.action}
                    </AdminStatusBadge>
                  </td>
                  <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                    {log.entity ?? "-"}#{log.entityId ?? "-"}
                  </td>
                  <td className="px-3 py-2.5 font-mono whitespace-nowrap text-secondary">
                    {log.actorType}#{log.actorId ?? "-"}
                  </td>
                  <td className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">
                    {log.action === "entity.soft_delete" && log.entity && log.entityId && (
                      isRestored ? (
                        <AdminStatusBadge tone="positive">복원 완료</AdminStatusBadge>
                      ) : (
                        <AdminActionForm
                          action={restore}
                          errorTitle="복원 실패"
                          successMessage={`${log.entity}#${log.entityId} 데이터가 복원되었습니다.`}
                          className="inline"
                        >
                          <button
                            type="submit"
                            className="h-6 rounded-btn-sm bg-positive px-2 text-xs font-medium text-white"
                          >
                            원클릭 복원
                          </button>
                        </AdminActionForm>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-xs text-subdued">
                  기록된 감사로그가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
