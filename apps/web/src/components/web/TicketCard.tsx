"use client";

import { BookOpen, ChevronRight, Video } from "lucide-react";
import { cn, PawIcon } from "@repo/ui";
import { AppLink } from "@/components/web/ui";

export type EffectiveTicketStatus = "AVAILABLE" | "USED" | "EXPIRED" | "REVOKED";

export interface UserTicketView {
  id: number;
  ticketType: "PREMIUM_UNLOCK" | "INQUIRY_TICKET";
  title: string;
  courseId: number | null;
  courseTitle: string | null;
  effectiveStatus: EffectiveTicketStatus;
  issuedAtText: string;
  usedAtText: string | null;
  expiresAtText: string | null;
  usedDogName: string | null;
}

export function TicketCard({ ticket }: { ticket: UserTicketView }) {
  const isAvailable = ticket.effectiveStatus === "AVAILABLE";
  const isCourse = ticket.ticketType === "PREMIUM_UNLOCK";
  const displayTitle = isCourse && ticket.courseTitle ? ticket.courseTitle : ticket.title;

  const actionLink =
    isCourse && ticket.courseId && ticket.effectiveStatus !== "REVOKED"
      ? { href: `/app/courses/${ticket.courseId}`, label: "강좌 보기" }
      : !isCourse && isAvailable
        ? { href: "/app/inquiry/new", label: "문의 작성" }
        : null;

  return (
    <div className="waggle-ticket-wrap">
      <article
        className={cn(
          "waggle-ticket-body flex min-h-29 items-stretch rounded-none",
          isAvailable ? "bg-surface" : "bg-surface-subtle",
        )}
      >
        {/* 좌측 직각 컬러 바 (border 없음) */}
        <div
          aria-hidden="true"
          className={cn(
            "w-2 shrink-0",
            !isAvailable
              ? "bg-ink-muted/25"
              : isCourse
                ? "bg-brand"
                : "bg-sky-500",
          )}
        />

        {/* 좌측 보딩패스 본문 */}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 py-4 pl-4 pr-3.5">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-bold",
                  !isAvailable
                    ? "text-ink-muted"
                    : isCourse
                      ? "text-emerald-700"
                      : "text-sky-600",
                )}
              >
                {isCourse ? (
                  <BookOpen className="size-3.5" strokeWidth={2.2} />
                ) : (
                  <Video className="size-3.5" strokeWidth={2.2} />
                )}
                {isCourse ? "프리미엄 강좌 티켓" : "1:1 영상 문의권"}
              </span>
              <span className="text-ink-muted/50">·</span>
              <span className="tabular-nums text-ink-muted">
                {ticket.expiresAtText ? `~${ticket.expiresAtText}` : "기간 제한 없음"}
              </span>
            </div>

            <h3
              className={cn(
                "mt-1.5 line-clamp-2 text-sm font-extrabold leading-snug tracking-tight",
                isAvailable ? "text-ink" : "text-ink-muted",
              )}
            >
              {displayTitle}
            </h3>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs tabular-nums text-ink-muted">
              {ticket.effectiveStatus === "USED" && ticket.usedAtText
                ? `사용 ${ticket.usedAtText}${ticket.usedDogName ? ` · ${ticket.usedDogName}` : ""}`
                : ticket.effectiveStatus === "EXPIRED" && ticket.expiresAtText
                  ? `만료 ${ticket.expiresAtText}`
                  : ticket.effectiveStatus === "REVOKED"
                    ? `발급 ${ticket.issuedAtText} · 취소됨`
                    : `발급 ${ticket.issuedAtText}`}
            </p>

            {actionLink && (
              <AppLink
                href={actionLink.href}
                className="inline-flex items-center gap-0.5 text-xs font-bold text-brand-strong transition-opacity active:opacity-65"
              >
                {actionLink.label}
                <ChevronRight className="size-3.5" strokeWidth={2.2} />
              </AppLink>
            )}
          </div>
        </div>

        {/* 중앙 점선 절취선 (상·하 반원 펀칭 구멍과 정확히 맞닿음) */}
        <div
          aria-hidden="true"
          className="my-3.5 w-px shrink-0 border-l-2 border-dashed border-ink/15"
        />

        {/* 우측 상태 도장 전용 스텁 (w-28 = 7rem, CSS mask --ticket-notch-x와 1:1 일치) */}
        <div className="flex w-28 shrink-0 flex-col items-center justify-center px-3 py-4">
          {ticket.effectiveStatus === "AVAILABLE" ? (
            /* 사용가능 도장 */
            <div
              aria-label="사용가능 도장"
              className={cn(
                "-rotate-6 rounded-xl border-2 p-1",
                isCourse
                  ? "border-brand/75 bg-brand-soft/65"
                  : "border-sky-500/70 bg-sky-50/85",
              )}
            >
              <div
                className={cn(
                  "rounded-lg border border-dashed px-2.5 py-1.5 text-center",
                  isCourse ? "border-brand/60" : "border-sky-400/75",
                )}
              >
                <span
                  className={cn(
                    "block text-xs font-extrabold leading-none tracking-tight",
                    isCourse ? "text-brand-strong" : "text-sky-700",
                  )}
                >
                  사용가능
                </span>
                <span
                  className={cn(
                    "mt-1 block text-2xs font-bold leading-none tracking-wider",
                    isCourse ? "text-emerald-700/80" : "text-sky-600/80",
                  )}
                >
                  PASS
                </span>
              </div>
            </div>
          ) : ticket.effectiveStatus === "USED" ? (
            /* 사용완료 — 멍멍이 발 도장 */
            <div
              aria-label="사용완료 도장"
              className="flex size-18 -rotate-12 items-center justify-center rounded-full border-2 border-brand/75 bg-brand-soft/75 p-1"
            >
              <div className="flex size-full flex-col items-center justify-center rounded-full border border-dashed border-brand/65">
                <PawIcon className="size-6 text-brand" />
                <span className="mt-0.5 text-2xs font-extrabold leading-none tracking-tight text-brand-strong">
                  사용완료
                </span>
              </div>
            </div>
          ) : ticket.effectiveStatus === "EXPIRED" ? (
            /* 만료 — 사용만료 도장 */
            <div
              aria-label="사용만료 도장"
              className="-rotate-12 rounded-xl border-2 border-rose-500/70 bg-rose-50/90 p-1"
            >
              <div className="rounded-lg border border-dashed border-rose-400/75 px-2 py-1.5 text-center">
                <span className="block text-xs font-extrabold leading-none tracking-tight text-rose-600">
                  사용만료
                </span>
                <span className="mt-0.5 block text-2xs font-bold leading-none tracking-wider text-rose-500/85">
                  EXPIRED
                </span>
              </div>
            </div>
          ) : (
            /* 환불·취소 — 취소완료 도장 */
            <div
              aria-label="취소완료 도장"
              className="-rotate-12 rounded-xl border-2 border-ink-muted/45 bg-surface-subtle p-1"
            >
              <div className="rounded-lg border border-dashed border-ink-muted/40 px-2 py-1.5 text-center">
                <span className="block text-xs font-extrabold leading-none tracking-tight text-ink-muted">
                  취소완료
                </span>
              </div>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
