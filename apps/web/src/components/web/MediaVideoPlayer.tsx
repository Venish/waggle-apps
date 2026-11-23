"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { cn } from "@repo/ui";
import { extractYoutubeVideoId, isImageMediaUrl, isVideoMediaUrl } from "@/00_lib/mediaUrl";

export interface VideoProgressMeta {
  currentTime: number;
  duration: number;
}

export interface MediaVideoPlayerProps {
  url?: string | null;
  youtubeVideoId?: string | null;
  title?: string;
  onVideoProgress?: (percent: number, meta?: VideoProgressMeta) => void;
  onPlayingChange?: (playing: boolean) => void;
  onEnded?: () => void;
}

type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

interface YTPlayerEvent {
  target: YTPlayerInstance;
  data: number;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number | undefined>;
      events?: {
        onReady?: (event: YTPlayerEvent) => void;
        onStateChange?: (event: YTPlayerEvent) => void;
        onError?: (event: YTPlayerEvent) => void;
      };
    },
  ) => YTPlayerInstance;
  PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Browser only"));
  }
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevReady?.();
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        ytApiPromise = null;
        reject(new Error("YouTube IFrame API failed to initialize"));
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        ytApiPromise = null;
        reject(new Error("Failed to load YouTube IFrame API script"));
      };
      document.head.appendChild(script);
    }
  });

  return ytApiPromise;
}

/**
 * 와글 공용 커스텀 비디오 오버레이
 * - 최초 재생 전(idle · loading · PLAYING 직후 450ms): 포스터 썸네일 유지로 YouTube 기본 UI/베젤 플래시 100% 은폐 후 부드러운 디졸브
 * - 재생 안정화(isRevealed=true): 완전 투명 탭 레이어 (화면 클릭 시 즉시 일시정지)
 * - 일시정지/재개 전환(paused · ended · 재개 직후 350ms): 다크 프로스트 백드롭 유지로 YouTube 일시정지/재개 베젤 잔상 은폐
 */
function CustomPlayOverlay({
  status,
  hasPlayedOnce = false,
  isRevealed = status === "playing",
  posterUrl,
  title,
  onToggle,
}: {
  status: PlayerStatus;
  hasPlayedOnce?: boolean;
  isRevealed?: boolean;
  posterUrl?: string;
  title: string;
  onToggle: () => void;
}) {
  const isPlaying = status === "playing";
  const isLoading = status === "loading";
  const isEnded = status === "ended";
  const isError = status === "error";
  const showPosterCover = Boolean(posterUrl) && !hasPlayedOnce;
  const showVeil = !isRevealed;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={
        isPlaying
          ? `${title} 일시정지`
          : isEnded
            ? `${title} 다시 재생`
            : `${title} 재생`
      }
      className="group absolute inset-0 z-10 flex h-full w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
    >
      {/* 배경 마스크 레이어 (부드러운 300ms 디졸브 페이드아웃) */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-300 ease-out",
          showVeil ? "opacity-100" : "opacity-0",
        )}
      >
        {showPosterCover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={posterUrl}
              alt=""
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 bg-ink/30" />
          </>
        ) : (
          <span className="block h-full w-full bg-ink/60 backdrop-blur-[3px]" />
        )}
      </span>

      {/* 중앙 컨트롤 버튼 (재생 안정화 전 로딩 중이거나 정지/종료 상태일 때 표시) */}
      <span
        className={cn(
          "relative z-10 flex flex-col items-center gap-2 transition-opacity duration-200",
          showVeil ? "opacity-100" : "opacity-0",
        )}
      >
        {isError ? (
          <span className="rounded-2xl bg-surface/95 px-4 py-2.5 text-xs font-bold text-ink shadow-md">
            영상을 불러오지 못했어요 · 탭하여 재시도
          </span>
        ) : (
          <>
            <span className="flex size-15 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-transform duration-150 group-hover:scale-105 group-active:scale-95">
              {isLoading || (isPlaying && !isRevealed) ? (
                <Loader2 className="size-6 animate-spin" strokeWidth={2.2} />
              ) : isEnded ? (
                <RotateCcw className="size-6" strokeWidth={2.2} />
              ) : (
                <Play className="size-7 translate-x-0.5 fill-current" strokeWidth={1.8} />
              )}
            </span>
            {status === "paused" && (
              <span className="rounded-full bg-ink/70 px-3 py-1 text-xs font-semibold text-white">
                일시정지 · 탭하여 이어서 보기
              </span>
            )}
            {isEnded && (
              <span className="rounded-full bg-ink/70 px-3 py-1 text-xs font-semibold text-white">
                시청 완료 · 다시 보기
              </span>
            )}
          </>
        )}
      </span>
    </button>
  );
}

function YouTubeCustomPlayer({
  videoId,
  title,
  onVideoProgress,
  onPlayingChange,
  onEnded,
}: {
  videoId: string;
  title: string;
  onVideoProgress?: (percent: number, meta?: VideoProgressMeta) => void;
  onPlayingChange?: (playing: boolean) => void;
  onEnded?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const pollRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const hasPlayedOnceRef = useRef(false);
  const isReadyRef = useRef(false);
  const pendingPlayRef = useRef(false);
  const callbacksRef = useRef({ onVideoProgress, onPlayingChange, onEnded });
  callbacksRef.current = { onVideoProgress, onPlayingChange, onEnded };

  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current !== null) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const duration = p.getDuration();
      const currentTime = p.getCurrentTime();
      if (duration && Number.isFinite(duration) && duration > 0) {
        const pct = Math.min(100, Math.round((currentTime / duration) * 100));
        callbacksRef.current.onVideoProgress?.(pct, { currentTime, duration });
      }
    }, 250);
  }, [stopPolling]);

  useEffect(() => {
    let cancelled = false;
    isReadyRef.current = false;
    hasPlayedOnceRef.current = false;
    setHasPlayedOnce(false);
    setIsRevealed(false);

    const mountNode = hostRef.current;
    if (!mountNode) return;
    mountNode.innerHTML = "";
    const targetEl = document.createElement("div");
    targetEl.className = "h-full w-full";
    mountNode.appendChild(targetEl);

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled) return;
        const player = new YT.Player(targetEl, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (ev) => {
              if (cancelled) return;
              isReadyRef.current = true;
              const dur = ev.target.getDuration();
              if (dur > 0) {
                callbacksRef.current.onVideoProgress?.(0, { currentTime: 0, duration: dur });
              }
              if (pendingPlayRef.current) {
                pendingPlayRef.current = false;
                ev.target.playVideo();
              }
            },
            onStateChange: (ev) => {
              if (cancelled) return;
              const state = ev.data;
              if (state === 1) {
                // PLAYING: YouTube 내부 재생/일시정지 베젤 잔상이 사라진 뒤(초회 450ms, 재개 350ms) 오버레이 디졸브
                setStatus("playing");
                callbacksRef.current.onPlayingChange?.(true);
                startPolling();
                clearRevealTimer();
                const delayMs = hasPlayedOnceRef.current ? 350 : 450;
                revealTimerRef.current = window.setTimeout(() => {
                  if (cancelled) return;
                  hasPlayedOnceRef.current = true;
                  setHasPlayedOnce(true);
                  setIsRevealed(true);
                }, delayMs);
              } else if (state === 2) {
                // PAUSED
                clearRevealTimer();
                stopPolling();
                setIsRevealed(false);
                setStatus("paused");
                callbacksRef.current.onPlayingChange?.(false);
                const dur = ev.target.getDuration();
                const cur = ev.target.getCurrentTime();
                if (dur > 0) {
                  callbacksRef.current.onVideoProgress?.(
                    Math.min(100, Math.round((cur / dur) * 100)),
                    { currentTime: cur, duration: dur },
                  );
                }
              } else if (state === 3) {
                // BUFFERING
                clearRevealTimer();
                stopPolling();
                setIsRevealed(false);
                setStatus("loading");
              } else if (state === 0) {
                // ENDED
                clearRevealTimer();
                stopPolling();
                setIsRevealed(false);
                setStatus("ended");
                callbacksRef.current.onPlayingChange?.(false);
                const dur = ev.target.getDuration();
                callbacksRef.current.onVideoProgress?.(100, {
                  currentTime: dur || 0,
                  duration: dur || 0,
                });
                callbacksRef.current.onEnded?.();
              }
            },
            onError: () => {
              if (cancelled) return;
              clearRevealTimer();
              stopPolling();
              setIsRevealed(false);
              setStatus("error");
              callbacksRef.current.onPlayingChange?.(false);
            },
          },
        });
        playerRef.current = player;
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });

    return () => {
      cancelled = true;
      clearRevealTimer();
      stopPolling();
      isReadyRef.current = false;
      pendingPlayRef.current = false;
      try {
        playerRef.current?.destroy();
      } catch {
        // unmount 시 이미 제거된 iframe 무시
      }
      playerRef.current = null;
    };
  }, [videoId, reloadNonce, clearRevealTimer, startPolling, stopPolling]);

  const handleToggle = () => {
    if (status === "error") {
      setStatus("idle");
      setReloadNonce((n) => n + 1);
      return;
    }

    const player = playerRef.current;
    if (!player || !isReadyRef.current) {
      pendingPlayRef.current = true;
      setStatus("loading");
      return;
    }

    if (status === "playing") {
      clearRevealTimer();
      setIsRevealed(false);
      player.pauseVideo();
    } else if (status === "ended") {
      player.seekTo(0, true);
      player.playVideo();
    } else {
      player.playVideo();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink">
      <div className="relative aspect-video w-full">
        {/* pointer-events-none으로 iframe 직접 클릭(유튜브 이동/기본 UI 간섭) 차단 */}
        <div
          ref={hostRef}
          className="pointer-events-none h-full w-full [&_iframe]:h-full [&_iframe]:w-full"
        />
        <CustomPlayOverlay
          status={status}
          hasPlayedOnce={hasPlayedOnce}
          isRevealed={isRevealed}
          posterUrl={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
          title={title}
          onToggle={handleToggle}
        />
      </div>
    </div>
  );
}

function NativeCustomVideoPlayer({
  url,
  title,
  onVideoProgress,
  onPlayingChange,
  onEnded,
}: {
  url: string;
  title: string;
  onVideoProgress?: (percent: number, meta?: VideoProgressMeta) => void;
  onPlayingChange?: (playing: boolean) => void;
  onEnded?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<PlayerStatus>("idle");

  const handleToggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (status === "playing") {
      v.pause();
    } else {
      if (status === "ended") {
        v.currentTime = 0;
      }
      void v.play().catch(() => {
        setStatus("error");
      });
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink">
      <div className="relative aspect-video w-full">
        <video
          ref={videoRef}
          src={url}
          playsInline
          preload="metadata"
          className="h-full w-full object-contain"
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.duration && Number.isFinite(v.duration) && v.duration > 0) {
              onVideoProgress?.(0, { currentTime: 0, duration: v.duration });
            }
          }}
          onPlay={() => {
            setStatus("playing");
            onPlayingChange?.(true);
          }}
          onPause={() => {
            const v = videoRef.current;
            if (v && !v.ended) {
              setStatus("paused");
              onPlayingChange?.(false);
            }
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.paused) return;
            if (v.duration && Number.isFinite(v.duration) && v.duration > 0) {
              onVideoProgress?.(Math.min(100, Math.round((v.currentTime / v.duration) * 100)), {
                currentTime: v.currentTime,
                duration: v.duration,
              });
            }
          }}
          onEnded={(e) => {
            const v = e.currentTarget;
            setStatus("ended");
            onPlayingChange?.(false);
            onVideoProgress?.(100, {
              currentTime: v.duration || 0,
              duration: v.duration || 0,
            });
            onEnded?.();
          }}
          onError={() => {
            setStatus("error");
            onPlayingChange?.(false);
          }}
        />
        <CustomPlayOverlay status={status} title={title} onToggle={handleToggle} />
      </div>
    </div>
  );
}

/**
 * (mobile) 공용 하이브리드 미디어 플레이어
 * - 업로드 영상(/api/uploads/...mp4|mov|webm): 커스텀 오버레이 HTML5 <video> (Range 206 스트리밍)
 * - 업로드 이미지: 반응형 <img>
 * - YouTube 링크 또는 11자리 ID: YouTube IFrame Player API (`controls=0`) + 와글 커스텀 Play/Pause 오버레이
 */
export function MediaVideoPlayer({
  url,
  youtubeVideoId,
  title = "와글 영상",
  onVideoProgress,
  onPlayingChange,
  onEnded,
}: MediaVideoPlayerProps) {
  if (url && isVideoMediaUrl(url)) {
    return (
      <NativeCustomVideoPlayer
        url={url}
        title={title}
        onVideoProgress={onVideoProgress}
        onPlayingChange={onPlayingChange}
        onEnded={onEnded}
      />
    );
  }

  if (url && isImageMediaUrl(url)) {
    return (
      <div className="overflow-hidden rounded-2xl bg-surface-subtle ring-1 ring-ink/[0.08]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={title} className="max-h-80 w-full object-contain" />
      </div>
    );
  }

  const ytId = extractYoutubeVideoId(youtubeVideoId ?? url);
  if (ytId) {
    return (
      <YouTubeCustomPlayer
        videoId={ytId}
        title={title}
        onVideoProgress={onVideoProgress}
        onPlayingChange={onPlayingChange}
        onEnded={onEnded}
      />
    );
  }

  return null;
}
