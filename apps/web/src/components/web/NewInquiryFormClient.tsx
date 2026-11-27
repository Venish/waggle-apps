"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Film, Ticket, Upload, X, Youtube } from "lucide-react";
import { extractYoutubeVideoId } from "@/00_lib/mediaUrl";
import { getMobileForwardTransitionTypes } from "@/00_lib/mobileRoutePresentation";
import {
  formatFileSize,
  MAX_UPLOAD_IMAGE_BYTES,
  MAX_UPLOAD_VIDEO_BYTES,
  uploadMediaFile,
  type UploadProgressInfo,
} from "@/00_lib/uploadClient";
import { createClientRequestKey, useSubmitLock } from "@/02_hooks/useSubmitLock";
import { createInquiryAction } from "@/03_actions/web/inquiryNoticeActions";
import type { RechargePackagePolicy } from "@/04_services/shared/policyService";
import { useModalStore } from "@/01_store/web/useModalStore";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { MediaVideoPlayer } from "@/components/web/MediaVideoPlayer";
import { RechargeClient } from "@/components/web/RechargeClient";
import {
  PointBalanceRechargeStrip,
  useInlineRechargeSheet,
} from "@/components/web/SheetTriggerButtons";
import {
  AppButton,
  AppInput,
  AppSegmented,
  AppSelectPicker,
  AppTextarea,
} from "@/components/web/ui";

type AttachMode = "UPLOAD" | "YOUTUBE";

export function NewInquiryFormClient({
  dogs,
  inquiryPrice,
  walletBalance,
  availableTickets = [],
  rechargePackages = [],
  inlineRechargeMode = "sheet",
}: {
  dogs: Array<{ id: number; name: string }>;
  inquiryPrice: number;
  walletBalance: number;
  availableTickets?: Array<{ id: number; title: string }>;
  rechargePackages?: RechargePackagePolicy[];
  inlineRechargeMode?: "sheet" | "step";
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);
  const dismissForNavigation = useModalStore((s) => s.dismissForNavigation);
  const openInlineRecharge = useInlineRechargeSheet();

  const [liveBalance, setLiveBalance] = useState(walletBalance);
  const [showRechargeStep, setShowRechargeStep] = useState(false);
  const [dogId, setDogId] = useState(dogs[0] ? String(dogs[0].id) : "");
  const [paymentMode, setPaymentMode] = useState<"TICKET" | "POINT">(
    availableTickets.length > 0 ? "TICKET" : "POINT",
  );
  const [question, setQuestion] = useState("");
  const [attachMode, setAttachMode] = useState<AttachMode>("UPLOAD");
  const [uploadedFile, setUploadedFile] = useState<{
    url: string;
    name: string;
    size: number;
  } | null>(null);
  const [youtubeInput, setYoutubeInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgressInfo | null>(null);
  const { pending, run } = useSubmitLock();
  const requestKeyRef = useRef<string>(createClientRequestKey("inq"));

  useEffect(() => {
    setLiveBalance(walletBalance);
  }, [walletBalance]);

  useEffect(() => {
    requestKeyRef.current = createClientRequestKey("inq");
  }, [liveBalance]);

  const dogOptions = useMemo(
    () => dogs.map((d) => ({ value: String(d.id), label: d.name })),
    [dogs],
  );

  const parsedYoutubeId = useMemo(() => extractYoutubeVideoId(youtubeInput), [youtubeInput]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);
    const maxBytes = isVideo ? MAX_UPLOAD_VIDEO_BYTES : MAX_UPLOAD_IMAGE_BYTES;

    setUploading(true);
    setProgress({ percent: 0, loaded: 0, total: file.size });
    try {
      const result = await uploadMediaFile(
        "/api/upload?category=inquiries",
        file,
        maxBytes,
        (info) => setProgress(info),
      );
      if (!result.ok) {
        openAlert({ title: "업로드 실패", description: result.error, tone: "destructive" });
        return;
      }
      setUploadedFile({ url: result.url, name: result.name, size: result.size });
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading) return;
    if (!dogId) {
      openAlert({ title: "반려견을 선택해 주세요" });
      return;
    }

    let finalVideoUrl: string | undefined;
    if (attachMode === "UPLOAD") {
      finalVideoUrl = uploadedFile?.url;
    } else if (youtubeInput.trim()) {
      if (!parsedYoutubeId) {
        openAlert({
          title: "유효한 YouTube 링크를 입력해 주세요",
          description: "youtube.com/watch?v=..., youtu.be/..., Shorts 링크 또는 11자리 영상 ID를 입력할 수 있습니다.",
        });
        return;
      }
      finalVideoUrl = `https://youtu.be/${parsedYoutubeId}`;
    }

    const selectedTicket = paymentMode === "TICKET" ? availableTickets[0] : undefined;

    void run(async () => {
      const res = await createInquiryAction({
        dogId: Number(dogId),
        question,
        videoUrl: finalVideoUrl,
        ticketId: selectedTicket?.id,
        idempotencyKey: requestKeyRef.current,
        expectedWalletBalance: selectedTicket ? undefined : liveBalance,
      });
      if (!res.ok) {
        if (res.error.code === "BALANCE_STALE") {
          if (typeof res.error.latestBalance === "number") {
            setLiveBalance(res.error.latestBalance);
          }
          requestKeyRef.current = createClientRequestKey("inq");
          router.refresh();
        }
        openAlert({
          title: res.error.code === "BALANCE_STALE" ? "보유 포인트 변경 안내" : "질문 접수 실패",
          description: res.error.message,
          tone: "destructive",
        });
        return;
      }
      const detailUrl = `/app/inquiry/${res.data.inquiryId}`;
      const transitionTypes = getMobileForwardTransitionTypes(detailUrl);
      if (dismissForNavigation()) {
        router.replace(detailUrl, { transitionTypes });
      } else {
        router.push(detailUrl, { transitionTypes });
      }
      router.refresh();
    });
  };

  const usingTicket = paymentMode === "TICKET" && availableTickets.length > 0;
  const pointShortfall = usingTicket ? 0 : Math.max(0, inquiryPrice - liveBalance);

  const handleOpenInlineRecharge = () => {
    if (inlineRechargeMode === "step") {
      setShowRechargeStep(true);
      return;
    }
    openInlineRecharge({
      packages: rechargePackages,
      walletBalance: liveBalance,
      requiredShortfall: pointShortfall > 0 ? pointShortfall : undefined,
      onRecharged: (pointAmount) => setLiveBalance((b) => b + pointAmount),
    });
  };

  return (
    <>
      {showRechargeStep && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setShowRechargeStep(false)}
            className="inline-flex items-center gap-1 text-xs font-bold text-ink-muted transition-colors hover:text-ink"
          >
            <ChevronLeft className="size-4" strokeWidth={2} />
            질문 작성으로 돌아가기
          </button>
          <RechargeClient
            packages={rechargePackages}
            walletBalance={liveBalance}
            requiredShortfall={pointShortfall > 0 ? pointShortfall : undefined}
            onBalanceSync={(latest) => setLiveBalance(latest)}
            onCompleted={({ pointAmount }) => {
              setLiveBalance((b) => b + pointAmount);
              setShowRechargeStep(false);
              openAlert({
                title: `+${pointAmount.toLocaleString("ko-KR")} P 충전 완료`,
                description: "보유 포인트가 즉시 반영되었습니다. 작성 중인 질문을 바로 접수할 수 있어요.",
              });
            }}
          />
        </div>
      )}

      <form
        noValidate
        onSubmit={handleSubmit}
        className={showRechargeStep ? "hidden" : "space-y-6"}
      >
      {availableTickets.length > 0 ? (
        <div className="space-y-3">
          <div className="space-y-3 rounded-2xl bg-brand-soft/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-brand-strong">
                <Ticket className="size-4 shrink-0" strokeWidth={2.2} />
                보유 문의권 {availableTickets.length}장 사용 가능
              </span>
              <span className="text-sm font-extrabold tabular-nums text-brand-strong">
                {usingTicket ? "0P" : `${inquiryPrice.toLocaleString("ko-KR")}P`}
              </span>
            </div>
            <AppSegmented<"TICKET" | "POINT">
              ariaLabel="문의 결제 수단 선택"
              value={paymentMode}
              onChange={setPaymentMode}
              options={[
                { value: "TICKET", label: "보유 문의권 사용 (0P)" },
                { value: "POINT", label: `포인트 (${inquiryPrice.toLocaleString("ko-KR")}P)` },
              ]}
            />
          </div>

          {!usingTicket && rechargePackages.length > 0 && (
            <PointBalanceRechargeStrip
              walletBalance={liveBalance}
              requiredPoint={inquiryPrice}
              packages={rechargePackages}
              onRecharged={(pointAmount) => setLiveBalance((b) => b + pointAmount)}
              onOpenRecharge={inlineRechargeMode === "step" ? handleOpenInlineRecharge : undefined}
            />
          )}
        </div>
      ) : rechargePackages.length > 0 ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="font-medium text-ink-muted">1:1 영상 Q&amp;A 차감 포인트</span>
            <strong className="text-sm font-extrabold tabular-nums text-brand-strong">
              {inquiryPrice.toLocaleString("ko-KR")} P
            </strong>
          </div>
          <PointBalanceRechargeStrip
            walletBalance={liveBalance}
            requiredPoint={inquiryPrice}
            packages={rechargePackages}
            onRecharged={(pointAmount) => setLiveBalance((b) => b + pointAmount)}
            onOpenRecharge={inlineRechargeMode === "step" ? handleOpenInlineRecharge : undefined}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-2xl bg-surface-subtle px-4 py-3.5">
          <span className="text-xs font-medium text-ink-muted">차감 포인트 / 보유 잔액</span>
          <span className="text-sm font-extrabold tabular-nums text-ink">
            <strong className="text-brand-strong">{inquiryPrice.toLocaleString("ko-KR")}P</strong> /{" "}
            {liveBalance.toLocaleString("ko-KR")}P
          </span>
        </div>
      )}

      <section className="space-y-5">
        <AppSelectPicker
          label="질문 대상 반려견"
          modalTitle="반려견 선택"
          value={dogId}
          onChange={setDogId}
          options={dogOptions}
        />

        <AppTextarea
          label="고민 내용 (10자 이상)"
          rows={5}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="문제 행동이 발생하는 상황, 빈도, 현재 대처 방식을 구체적으로 적어주세요."
        />

        {/* 첨부 영상/사진 (파일 업로드 | YouTube 링크 2탭) */}
        <div className="space-y-3">
          <AppSegmented
            label="행동 영상 · 사진 첨부"
            value={attachMode}
            onChange={setAttachMode}
            options={[
              { value: "UPLOAD", label: "파일 업로드" },
              { value: "YOUTUBE", label: "YouTube 링크" },
            ]}
          />

          {attachMode === "UPLOAD" ? (
            <div key="inquiry-upload-panel" className="space-y-2.5">
              {uploading && progress ? (
                <div className="space-y-2 rounded-2xl bg-surface-subtle p-4">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-ink">업로드 중...</span>
                    <span className="tabular-nums text-brand-strong">
                      {progress.percent}% ({formatFileSize(progress.loaded)} /{" "}
                      {formatFileSize(progress.total)})
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                    <div
                      className="h-full rounded-full bg-brand transition-[width] duration-150"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              ) : uploadedFile ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 rounded-2xl bg-brand-soft/60 px-3.5 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Film className="size-4 shrink-0 text-brand-strong" strokeWidth={2} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-ink">{uploadedFile.name}</p>
                        <p className="text-xs tabular-nums text-ink-muted">
                          {formatFileSize(uploadedFile.size)} · 첨부 완료
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="첨부 파일 삭제"
                      onClick={() => setUploadedFile(null)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-ink-muted hover:text-ink"
                    >
                      <X className="size-3.5" strokeWidth={2.2} />
                    </button>
                  </div>
                  <MediaVideoPlayer url={uploadedFile.url} title={uploadedFile.name} />
                </div>
              ) : (
                <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-surface-subtle text-xs font-semibold text-ink transition-colors hover:bg-ink/[0.06]">
                  <Upload className="size-4 text-ink-muted" strokeWidth={2} />
                  영상 또는 사진 선택
                  <input
                    type="file"
                    accept="video/*,image/*"
                    className="hidden"
                    onChange={handleUpload}
                  />
                </label>
              )}
              <p className="text-xs leading-relaxed text-ink-muted">
                영상(MP4·MOV·WebM) 최대 50MB · 사진 최대 15MB (50MB 초과는 YouTube 링크 탭을 이용해 주세요)
              </p>
            </div>
          ) : (
            <div key="inquiry-youtube-panel" className="space-y-2.5">
              <AppInput
                id="inquiry-yt-url"
                label="YouTube 링크 또는 영상 ID"
                type="text"
                value={youtubeInput}
                onChange={(e) => setYoutubeInput(e.target.value)}
                clearable
                onClear={() => setYoutubeInput("")}
                placeholder="https://youtu.be/... (일부공개 링크 권장)"
              />
              {youtubeInput.trim() && (
                parsedYoutubeId ? (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1 text-xs font-semibold text-brand-strong">
                      <Youtube className="size-3.5" strokeWidth={2} />
                      YouTube 영상이 정상 인식되었습니다
                    </p>
                    <MediaVideoPlayer youtubeVideoId={parsedYoutubeId} title="첨부 YouTube 미리보기" />
                  </div>
                ) : (
                  <p className="text-xs font-medium text-destructive">
                    올바른 YouTube URL 형식이 아닙니다.
                  </p>
                )
              )}
            </div>
          )}
        </div>
      </section>

      {pointShortfall > 0 && rechargePackages.length > 0 ? (
        <AppButton
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          disabled={uploading}
          onClick={handleOpenInlineRecharge}
        >
          부족한 {pointShortfall.toLocaleString("ko-KR")} P 충전하기
        </AppButton>
      ) : (
        <AppButton type="submit" variant="primary" size="lg" fullWidth loading={pending || uploading}>
          {pending
            ? "접수 중..."
            : usingTicket
              ? "보유 문의권 1장 차감하고 질문 접수 (0P)"
              : `${inquiryPrice.toLocaleString("ko-KR")} P 차감하고 질문 접수`}
        </AppButton>
      )}
      </form>
    </>
  );
}
