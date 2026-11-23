import { and, desc, eq, getDb, trainers, trainerSettlements } from "@repo/db";
import { requireAdminSession } from "@/00_lib/session";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function TrainerMySettlementsPage() {
  const session = await requireAdminSession(["TRAINER", "ADMIN"]);
  const db = getDb();

  const [trainer] = await db
    .select()
    .from(trainers)
    .where(and(eq(trainers.adminId, session.adminId), eq(trainers.isDeleted, false)))
    .limit(1);

  const list = trainer
    ? await db
        .select()
        .from(trainerSettlements)
        .where(and(eq(trainerSettlements.trainerId, trainer.id), eq(trainerSettlements.isDeleted, false)))
        .orderBy(desc(trainerSettlements.periodYm))
    : [];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="내 월 정산 조회"
        description={trainer ? `${trainer.name} 본인 정산 이력` : "연동된 훈련사 프로필이 없습니다."}
      />

      <div className="overflow-x-auto rounded-panel bg-base-1 atlas-border">
        <table className="w-full min-w-full text-left">
          <thead>
            <tr className="h-9 bg-base-2 text-xs text-secondary atlas-border-b">
              <th className="py-2 pl-4 pr-3">정산월</th>
              <th className="px-3 py-2 text-right">답변 건수</th>
              <th className="px-3 py-2 text-right">포인트 합계</th>
              <th className="px-3 py-2 text-right">지급 원화</th>
              <th className="py-2 pl-3 pr-4 text-right">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline text-xs">
            {list.map((r) => (
              <tr key={r.id}>
                <td className="py-2.5 pl-4 pr-3 font-mono">{r.periodYm}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{r.totalInquiries}건</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{r.totalPoints.toLocaleString("ko-KR")} P</td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                  {r.payoutAmount.toLocaleString("ko-KR")}원
                </td>
                <td className="py-2.5 pl-3 pr-4 text-right">
                  <AdminStatusBadge tone={r.status === "PAID" ? "positive" : "info"}>
                    {r.status}
                  </AdminStatusBadge>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-xs text-subdued">
                  집계된 월 정산 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
