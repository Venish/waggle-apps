import { desc, eq, getDb, trainers, trainerSettlements } from "@repo/db";
import { requireAdminSession } from "@/00_lib/session";
import {
  adminGenerateMonthlySettlementAction,
  adminUpdateSettlementStatusAction,
} from "@/03_actions/admin/adminTrainerOpsActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminTrainerSettlementsPage() {
  await requireAdminSession(["ADMIN"]);
  const db = getDb();

  const [rows, trainerList] = await Promise.all([
    db.select().from(trainerSettlements).where(eq(trainerSettlements.isDeleted, false)).orderBy(desc(trainerSettlements.id)),
    db.select().from(trainers).where(eq(trainers.isDeleted, false)),
  ]);
  const trainerMap = new Map(trainerList.map((t) => [t.id, t.name]));
  const currentYm = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  async function generate(formData: FormData) {
    "use server";
    return adminGenerateMonthlySettlementAction(String(formData.get("periodYm") ?? currentYm));
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="훈련사 월 정산 관리"
        description="답변 완료(ANSWERED) 문의 차감 포인트 × settlement.commission_rate 기준 산출"
      />

      <AdminActionForm
        action={generate}
        errorTitle="정산 집계 실패"
        successMessage="월 정산 집계가 완료되었습니다."
        className="flex flex-wrap items-center gap-2 rounded-panel bg-base-2 p-3 atlas-border"
      >
        <input name="periodYm" defaultValue={currentYm} className="h-7 w-28 shrink-0 rounded-control bg-base-1 px-2.5 font-mono text-xs atlas-border" />
        <button type="submit" className="h-7 shrink-0 whitespace-nowrap rounded-control bg-inverse px-3 text-control font-medium text-on-inverse">
          해당 월 정산 집계 실행
        </button>
      </AdminActionForm>

      <div className="overflow-x-auto rounded-panel bg-base-1 atlas-border">
        <table className="w-full min-w-full text-left">
          <thead>
            <tr className="h-9 bg-base-2 text-xs text-secondary atlas-border-b">
              <th className="py-2 pl-4 pr-3 whitespace-nowrap">정산월</th>
              <th className="px-3 py-2 whitespace-nowrap">훈련사</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">답변 건수</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">포인트 합계</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">지급액</th>
              <th className="px-3 py-2 whitespace-nowrap">상태</th>
              <th className="py-2 pl-3 pr-4 text-right whitespace-nowrap">처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline text-xs">
            {rows.map((r) => {
              async function confirm() {
                "use server";
                return adminUpdateSettlementStatusAction({ id: r.id, status: "CONFIRMED" });
              }
              async function markPaid() {
                "use server";
                return adminUpdateSettlementStatusAction({ id: r.id, status: "PAID" });
              }

              return (
                <tr key={r.id}>
                  <td className="py-2.5 pl-4 pr-3 font-mono whitespace-nowrap">{r.periodYm}</td>
                  <td className="px-3 py-2.5 font-medium whitespace-nowrap">{trainerMap.get(r.trainerId) ?? `#${r.trainerId}`}</td>
                  <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap tabular-nums">{r.totalInquiries}건</td>
                  <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap tabular-nums">{r.totalPoints.toLocaleString("ko-KR")} P</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap tabular-nums">
                    {r.payoutAmount.toLocaleString("ko-KR")}원
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <AdminStatusBadge tone={r.status === "PAID" ? "positive" : r.status === "CONFIRMED" ? "info" : "warning"}>
                      {r.status}
                    </AdminStatusBadge>
                  </td>
                  <td className="py-2.5 pl-3 pr-4 text-right whitespace-nowrap">
                    {r.status === "DRAFT" && (
                      <AdminActionForm action={confirm} successMessage="정산이 확정되었습니다." className="inline">
                        <button type="submit" className="h-6 rounded-btn-sm bg-inverse px-2 text-xs text-on-inverse">
                          확정
                        </button>
                      </AdminActionForm>
                    )}
                    {r.status === "CONFIRMED" && (
                      <AdminActionForm action={markPaid} successMessage="지급 완료로 처리되었습니다." className="inline">
                        <button type="submit" className="h-6 rounded-btn-sm bg-positive px-2 text-xs text-white">
                          지급완료
                        </button>
                      </AdminActionForm>
                    )}
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
