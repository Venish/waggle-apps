import Link from "next/link";
import { and, desc, eq, getDb, inquiries, trainers } from "@repo/db";
import { formatDateTimeDot } from "@/00_lib/formatDate";
import { requireAdminSession } from "@/00_lib/session";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function TrainerPortalInquiriesPage() {
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
        .from(inquiries)
        .where(and(eq(inquiries.trainerId, trainer.id), eq(inquiries.isDeleted, false)))
        .orderBy(desc(inquiries.id))
    : [];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="내 배정 영상 Q&A 답변"
        description={trainer ? `${trainer.name}에게 배정된 1:1 영상 Q&A 목록` : "연동된 훈련사 프로필이 없습니다."}
      />

      <div className="overflow-x-auto rounded-panel bg-base-1 atlas-border">
        <table className="w-full min-w-full text-left">
          <thead>
            <tr className="h-9 bg-base-2 text-xs text-secondary atlas-border-b">
              <th className="py-2 pl-4 pr-3">ID</th>
              <th className="px-3 py-2">질문 내용</th>
              <th className="px-3 py-2">상태</th>
              <th className="py-2 pl-3 pr-4 text-right">SLA 마감</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline text-sm">
            {list.map((inq) => (
              <tr key={inq.id} className="hover:bg-[var(--mix-table-hover)]">
                <td className="py-2.5 pl-4 pr-3 font-mono text-xs whitespace-nowrap text-secondary">#{inq.id}</td>
                <td className="px-3 py-2.5">
                  <Link href={`/admin/trainer/${inq.id}`} className="block font-medium text-info hover:underline">
                    {inq.question.slice(0, 60)}
                  </Link>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <AdminStatusBadge tone={inq.status === "ANSWERED" ? "positive" : "warning"}>
                    {inq.status}
                  </AdminStatusBadge>
                </td>
                <td className="py-2.5 pl-3 pr-4 text-right font-mono text-xs whitespace-nowrap tabular-nums text-subdued">
                  {formatDateTimeDot(inq.slaDueAt)}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-xs text-subdued">
                  배정된 Q&amp;A가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
