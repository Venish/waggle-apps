import { notFound } from "next/navigation";
import { and, eq, getDb, inquiries, trainers } from "@repo/db";
import { formatDateTimeDot } from "@/00_lib/formatDate";
import { requireUserSession } from "@/00_lib/session";
import { cancelInquiryAction } from "@/03_actions/web/inquiryNoticeActions";
import { MediaVideoPlayer } from "@/components/web/MediaVideoPlayer";
import { SubPageHeader } from "@/components/web/WebUiKit";
import { AppBadge, appButtonClass } from "@/components/web/ui";

export const dynamic = "force-dynamic";

const INQUIRY_STATUS_LABEL: Record<string, string> = {
  PENDING: "접수 대기",
  ASSIGNED: "훈련사 배정",
  ANSWERED: "답변 완료",
  EXPIRED: "SLA 만료·환불",
  CANCELLED: "취소·환불",
};

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireUserSession();
  const { id } = await params;
  const inquiryId = Number(id);
  if (!Number.isInteger(inquiryId)) notFound();

  const db = getDb();
  const [inq] = await db
    .select()
    .from(inquiries)
    .where(
      and(
        eq(inquiries.id, inquiryId),
        eq(inquiries.userId, session.userId),
        eq(inquiries.isDeleted, false),
      ),
    )
    .limit(1);
  if (!inq) notFound();

  const [trainer] = inq.trainerId
    ? await db.select().from(trainers).where(eq(trainers.id, inq.trainerId)).limit(1)
    : [];

  async function handleCancel() {
    "use server";
    await cancelInquiryAction(inquiryId);
  }

  return (
    <div className="space-y-6">
      <SubPageHeader title={`Q&A #${inq.id}`} backHref="/app/inquiry" />

      <section className="space-y-3 border-b border-border-subtle pb-5">
        <div className="flex items-center justify-between gap-2">
          <AppBadge tone={inq.status === "ANSWERED" ? "brand" : "ink"} size="md">
            {INQUIRY_STATUS_LABEL[inq.status] ?? inq.status}
          </AppBadge>
          <span className="text-xs font-semibold tabular-nums text-ink-muted">
            차감 {inq.paidPoints.toLocaleString("ko-KR")} P
          </span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{inq.question}</p>
        {inq.videoUrl && <MediaVideoPlayer url={inq.videoUrl} title={`Q&A #${inq.id} 첨부 영상`} />}
        <p className="text-xs tabular-nums text-ink-muted">
          48h SLA 마감: {formatDateTimeDot(inq.slaDueAt)}
        </p>
      </section>

      {inq.answerText ? (
        <section className="space-y-3 rounded-2xl bg-brand-soft p-5 text-ink">
          <p className="text-xs font-bold text-brand-strong">
            {trainer?.name ?? "담당 훈련사"} 답변 완료 ({formatDateTimeDot(inq.answeredAt)})
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{inq.answerText}</p>
          {inq.answerVideoUrl && (
            <MediaVideoPlayer url={inq.answerVideoUrl} title="훈련사 솔루션 답변 영상" />
          )}
        </section>
      ) : (
        <div className="rounded-2xl bg-surface-subtle p-5 text-center text-sm text-ink-muted">
          {trainer
            ? `${trainer.name} 훈련사님이 답변을 준비 중입니다.`
            : "전문 훈련사 배정 대기 중입니다."}
        </div>
      )}

      {(inq.status === "PENDING" || inq.status === "ASSIGNED") && (
        <form action={handleCancel}>
          <button
            type="submit"
            className={appButtonClass({ variant: "danger", size: "md", fullWidth: true })}
          >
            답변 전 문의 취소 및 전액 환불 ({inq.paidPoints.toLocaleString("ko-KR")}P)
          </button>
        </form>
      )}
    </div>
  );
}
