import { notFound } from "next/navigation";
import { eq, getDb, inquiries } from "@repo/db";
import { formatDateTimeDot } from "@/00_lib/formatDate";
import { requireAdminSession } from "@/00_lib/session";
import { trainerSubmitAnswerAction } from "@/03_actions/admin/adminTrainerOpsActions";
import { AdminActionForm } from "@/components/admin/AdminActionForm";
import { AdminMediaPlayer } from "@/components/admin/AdminMediaPlayer";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin/AdminUiKit";
import { AdminVideoSourceField } from "@/components/admin/AdminVideoSourceField";

export const dynamic = "force-dynamic";

export default async function TrainerInquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession(["TRAINER", "ADMIN"]);
  const { id } = await params;
  const inquiryId = Number(id);
  if (!Number.isInteger(inquiryId)) notFound();

  const db = getDb();
  const [inq] = await db.select().from(inquiries).where(eq(inquiries.id, inquiryId)).limit(1);
  if (!inq) notFound();

  async function submitAnswer(formData: FormData) {
    "use server";
    return trainerSubmitAnswerAction({
      inquiryId,
      answerText: String(formData.get("answerText") ?? ""),
      answerVideoUrl: String(formData.get("answerVideoUrl") ?? ""),
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <AdminPageHeader
        title={`배정 Q&A 상세 #${inq.id}`}
        description={`SLA 마감: ${formatDateTimeDot(inq.slaDueAt)}`}
      />

      <div className="space-y-3 rounded-panel bg-base-2 p-4 atlas-border">
        <AdminStatusBadge tone={inq.status === "ANSWERED" ? "positive" : "warning"}>
          {inq.status}
        </AdminStatusBadge>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral">{inq.question}</p>
        {inq.videoUrl && (
          <div className="space-y-1.5 pt-1">
            <p className="text-xs font-medium text-secondary">보호자 첨부 영상 · 사진</p>
            <AdminMediaPlayer url={inq.videoUrl} title={`Q&A #${inq.id} 보호자 첨부`} />
          </div>
        )}
      </div>

      <AdminActionForm
        action={submitAnswer}
        errorTitle="답변 등록 실패"
        successMessage="훈련사 솔루션 답변이 등록되고 보호자에게 알림이 발송되었습니다."
        redirectTo="/admin/trainer"
        className="space-y-3 rounded-panel bg-base-2 p-4 atlas-border"
      >
        <h3 className="text-sm font-semibold">훈련사 맞춤 솔루션 답변 제출</h3>
        <textarea
          name="answerText"
          rows={6}
          defaultValue={inq.answerText ?? ""}
          placeholder="반려견 행동 원인 분석과 단계별 교정 가이드를 작성해 주세요."
          className="w-full rounded-control bg-base-1 p-3 text-sm atlas-border"
        />
        <AdminVideoSourceField
          uploadCategory="inquiries"
          videoUrlName="answerVideoUrl"
          initialVideoUrl={inq.answerVideoUrl}
          allowImage
          label="답변 솔루션 영상 · 사진 첨부 (선택)"
        />
        <button
          type="submit"
          className="h-7 rounded-control bg-inverse px-3 text-control font-medium text-on-inverse"
        >
          답변 등록 및 보호자 알림 발송
        </button>
      </AdminActionForm>
    </div>
  );
}
