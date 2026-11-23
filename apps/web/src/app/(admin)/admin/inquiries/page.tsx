import { desc, eq, getDb, inquiries, trainers } from "@repo/db";
import { formatDateTimeDot } from "@/00_lib/formatDate";
import { requireAdminSession } from "@/00_lib/session";
import { adminAssignInquiryAction } from "@/03_actions/admin/adminTrainerOpsActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminMediaPlayer } from "@/components/admin/AdminMediaPlayer";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminUiKit";

export const dynamic = "force-dynamic";

export default async function AdminInquiriesPage() {
  await requireAdminSession(["ADMIN"]);
  const db = getDb();

  const [list, trainerList] = await Promise.all([
    db.select().from(inquiries).where(eq(inquiries.isDeleted, false)).orderBy(desc(inquiries.id)),
    db.select().from(trainers).where(eq(trainers.isDeleted, false)),
  ]);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="영상 Q&A 모니터링 & 훈련사 배정"
        description="48h SLA 모니터링 및 훈련사 수동 배정"
      />

      <div className="space-y-3">
        {list.map((inq) => {
          async function assignTrainer(formData: FormData) {
            "use server";
            return adminAssignInquiryAction({
              inquiryId: inq.id,
              trainerId: Number(formData.get("trainerId")),
            });
          }

          return (
            <div key={inq.id} className="rounded-panel bg-base-2 p-4 space-y-2.5 atlas-border">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-secondary">Q&amp;A #{inq.id}</span>
                  <AdminStatusBadge
                    tone={
                      inq.status === "ANSWERED"
                        ? "positive"
                        : inq.status === "EXPIRED"
                          ? "negative"
                          : "warning"
                    }
                  >
                    {inq.status}
                  </AdminStatusBadge>
                  <span className="font-mono text-xs tabular-nums text-subdued">
                    차감 {inq.paidPoints.toLocaleString("ko-KR")}P
                  </span>
                </div>
                <span className="font-mono text-xs tabular-nums text-subdued">
                  SLA 마감: {formatDateTimeDot(inq.slaDueAt)}
                </span>
              </div>

              <p className="text-sm text-neutral">{inq.question}</p>

              {inq.videoUrl && (
                <AdminMediaPlayer url={inq.videoUrl} title={`Q&A #${inq.id} 첨부`} compact />
              )}

              {(inq.status === "PENDING" || inq.status === "ASSIGNED") && (
                <AdminActionForm
                  action={assignTrainer}
                  errorTitle="훈련사 배정 실패"
                  successMessage="훈련사 배정이 반영되었습니다."
                  className="flex flex-wrap items-center gap-2 pt-1"
                >
                  <select
                    name="trainerId"
                    defaultValue={inq.trainerId ?? trainerList[0]?.id}
                    className="h-7 min-w-0 flex-1 sm:flex-none rounded-control bg-base-1 px-2.5 text-xs atlas-border"
                  >
                    {trainerList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="h-7 shrink-0 whitespace-nowrap rounded-control bg-inverse px-2.5 text-xs font-medium text-on-inverse">
                    훈련사 배정
                  </button>
                </AdminActionForm>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
