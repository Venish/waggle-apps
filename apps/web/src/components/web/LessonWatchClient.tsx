"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, PlayCircle } from "lucide-react";
import { cn } from "@repo/ui";
import { completeLessonWatchAction } from "@/03_actions/web/onboardingEducationActions";
import { useWebAlertStore } from "@/01_store/web/useWebAlertStore";
import { LessonStepSummaryCard } from "@/components/web/LessonStepHeader";
import { MediaVideoPlayer, type VideoProgressMeta } from "@/components/web/MediaVideoPlayer";
import { AppButton, AppLinkButton } from "@/components/web/ui";

function formatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function LessonWatchClient({
  lessonId,
  lessonTitle,
  lessonSummary,
  youtubeVideoId,
  videoUrl,
  requiredPercent,
  initialMaxPercent,
  alreadyCompleted = false,
  completedDateText = null,
  isDevMode,
}: {
  lessonId: number;
  lessonTitle: string;
  lessonSummary?: string | null;
  youtubeVideoId: string | null;
  videoUrl: string | null;
  requiredPercent: number;
  initialMaxPercent: number;
  alreadyCompleted?: boolean;
  completedDateText?: string | null;
  isDevMode: boolean;
}) {
  const router = useRouter();
  const openAlert = useWebAlertStore((s) => s.openAlert);

  const [livePercent, setLivePercent] = useState(alreadyCompleted ? 100 : initialMaxPercent);
  const [maxPercent, setMaxPercent] = useState(alreadyCompleted ? 100 : initialMaxPercent);
  const [timeMeta, setTimeMeta] = useState<VideoProgressMeta | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completed, setCompleted] = useState(alreadyCompleted);
  const [pending, setPending] = useState(false);

  const autoCompletedRef = useRef(alreadyCompleted);
  const pendingRef = useRef(false);

  const handleComplete = useCallback(
    async (pct: number) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setPending(true);
      try {
        const res = await completeLessonWatchAction({ lessonId, watchedPercent: pct });
        if (!res.ok) {
          autoCompletedRef.current = false;
          openAlert({ title: "시청 기록 오류", description: res.error.message, tone: "destructive" });
          return;
        }
        setLivePercent(Math.max(pct, 100));
        setMaxPercent(Math.max(pct, 100));
        setCompleted(true);
        autoCompletedRef.current = true;
        openAlert({
          title: "1단계 영상 시청 완료",
          description:
            res.data.awardedPoints > 0
              ? `+${res.data.awardedPoints}P가 적립되었습니다! 2단계 실습 체크로 이동할까요?`
              : "영상 시청이 완료되었습니다. 2단계 실습으로 이동할까요?",
          confirmLabel: "2단계 실습으로 이동",
          cancelLabel: "여기 머물기",
          onConfirm: () => {
            router.replace(`/app/lesson/${lessonId}/practice`, {
              transitionTypes: ["waggle-push-forward"],
            });
          },
        });
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
    [lessonId, openAlert, router],
  );

  const handleVideoProgress = useCallback(
    (nextPct: number, meta?: VideoProgressMeta) => {
      if (meta) setTimeMeta(meta);
      setLivePercent(nextPct);
      setMaxPercent((prev) => Math.max(prev, nextPct));

      if (!autoCompletedRef.current && nextPct >= requiredPercent) {
        autoCompletedRef.current = true;
        void handleComplete(Math.max(nextPct, requiredPercent));
      }
    },
    [handleComplete, requiredPercent],
  );

  const handleVideoEnded = useCallback(() => {
    setLivePercent(100);
    setMaxPercent(100);
    if (!autoCompletedRef.current) {
      autoCompletedRef.current = true;
      void handleComplete(100);
    }
  }, [handleComplete]);

  const hasStartedPlayback = isPlaying || (timeMeta?.currentTime ?? 0) > 0;
  const displayPercent = hasStartedPlayback ? livePercent : completed ? 100 : livePercent;
  const isPausedMidway = !isPlaying && (timeMeta?.currentTime ?? 0) > 0 && livePercent < 100;
  const canManualComplete = isDevMode || maxPercent >= requiredPercent;

  return (
    <div className="space-y-5">
      <LessonStepSummaryCard
        title={lessonTitle}
        description={lessonSummary}
        completed={completed}
        completedDateText={completedDateText}
      />

      {/* 16:9 와글 커스텀 오버레이 플레이어 (YouTube IFrame API controls=0 · 화면 탭 Play/Pause) */}
      <MediaVideoPlayer
        url={videoUrl}
        youtubeVideoId={youtubeVideoId}
        title={lessonTitle}
        onVideoProgress={handleVideoProgress}
        onPlayingChange={setIsPlaying}
        onEnded={handleVideoEnded}
      />

      <section className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm font-bold text-ink">
            <span className="flex items-center gap-1.5">
              {isPlaying ? (
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-brand animate-pulse"
                />
              ) : isPausedMidway ? (
                <Pause className="size-3.5 text-ink-muted" strokeWidth={2.4} />
              ) : (
                <PlayCircle className="size-4 text-brand" strokeWidth={2} />
              )}
              {isPlaying ? "재생 중" : isPausedMidway ? "일시정지" : "시청 진도"}
            </span>
            <span className="flex items-center gap-2 text-xs tabular-nums">
              {timeMeta && timeMeta.duration > 0 && (
                <span className="font-medium text-ink-muted">
                  {formatMediaTime(timeMeta.currentTime)} / {formatMediaTime(timeMeta.duration)}
                </span>
              )}
              <strong className="text-sm font-extrabold text-brand-strong">
                {displayPercent}%
              </strong>
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-200",
                isPlaying || completed ? "waggle-progress-flow" : "bg-brand/60",
              )}
              style={{ width: `${displayPercent}%` }}
            />
          </div>

          {!completed && (
            <p className="text-xs leading-relaxed text-ink-muted">
              재생 중 화면을 탭하면 일시정지되며, 끝까지 시청하면 1단계가 자동 완료됩니다.
            </p>
          )}
        </div>

        <div className="pt-6">
          {completed ? (
            <AppLinkButton
              href={`/app/lesson/${lessonId}/practice`}
              variant="primary"
              size="lg"
              fullWidth
            >
              2단계 실습 체크
            </AppLinkButton>
          ) : (
            <AppButton
              variant="primary"
              size="lg"
              fullWidth
              loading={pending}
              disabled={!canManualComplete}
              onClick={() => void handleComplete(100)}
            >
              {pending
                ? "저장 중..."
                : maxPercent >= requiredPercent
                  ? "영상 시청 완료 및 포인트 받기"
                  : isDevMode
                    ? "[개발용] 시청 완료 처리"
                    : `영상 시청 중 (${displayPercent}%)`}
            </AppButton>
          )}
        </div>
      </section>
    </div>
  );
}
