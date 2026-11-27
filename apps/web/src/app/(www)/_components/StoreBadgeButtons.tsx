"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { encode } from "uqr";
import { ArrowRight, Smartphone, X } from "lucide-react";
import { WaggleMark } from "@repo/ui";
import styles from "../landing.module.css";

export type StoreKind = "app-store" | "google-play";
export type StoreBadgeTheme = "dark" | "light";
export type StoreBadgeSize = "sm" | "md";

const IOS_STORE_URL = process.env.NEXT_PUBLIC_IOS_STORE_URL?.trim() || "";
const ANDROID_STORE_URL = process.env.NEXT_PUBLIC_ANDROID_STORE_URL?.trim() || "";

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.33c.64-.78 1.08-1.86.96-2.94-.93.04-2.06.62-2.72 1.4-.58.68-1.1 1.79-.96 2.84 1.04.08 2.09-.52 2.72-1.3z" />
    </svg>
  );
}

function GooglePlayLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      <path
        fill="#00d0ff"
        d="M3.609 1.814L13.792 12 3.61 22.186a1.76 1.76 0 0 1-.61-1.34V3.154c0-.525.235-.996.609-1.34z"
      />
      <path
        fill="#ffce00"
        d="M17.209 8.583L13.792 12l3.417 3.417 3.861-2.207c.727-.415.727-1.462 0-1.877l-3.861-2.75z"
      />
      <path
        fill="#ff3d47"
        d="M17.209 15.417L13.792 12 3.609 22.186c.42.368 1.04.458 1.622.126l11.978-6.895z"
      />
      <path
        fill="#00f076"
        d="M17.209 8.583L5.231 1.688c-.582-.332-1.202-.242-1.622.126L13.792 12l3.417-3.417z"
      />
    </svg>
  );
}

function StoreQrCode({ url }: { url: string }) {
  const { modules, size } = useMemo(() => {
    const result = encode(url, { ecc: "Q", border: 2 });
    return { modules: result.data, size: result.size };
  }, [url]);

  const pathData = useMemo(() => {
    const parts: string[] = [];
    for (let y = 0; y < size; y++) {
      const row = modules[y];
      if (!row) continue;
      for (let x = 0; x < size; x++) {
        if (row[x]) {
          parts.push(`M${x},${y}h1v1h-1z`);
        }
      }
    }
    return parts.join("");
  }, [modules, size]);

  return (
    <div className="relative mx-auto size-[9.25rem] overflow-hidden rounded-xl bg-white p-1.5 ring-1 ring-black/10">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="size-full"
        shapeRendering="crispEdges"
        role="img"
        aria-label="스토어 다운로드 QR 코드"
      >
        <rect width={size} height={size} fill="#ffffff" />
        <path d={pathData} fill="#0a0a0a" />
      </svg>
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex size-[26%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg bg-white p-1 shadow-xs">
        <WaggleMark className="size-full text-brand" />
      </div>
    </div>
  );
}

export interface StoreBadgeProps {
  store: StoreKind;
  href?: string;
  theme?: StoreBadgeTheme;
  size?: StoreBadgeSize;
  qr?: boolean;
  onUnavailableClick?: (store: StoreKind) => void;
}

export function StoreBadge({
  store,
  href,
  theme = "dark",
  size = "md",
  qr = false,
  onUnavailableClick,
}: StoreBadgeProps) {
  const isAppStore = store === "app-store";
  const subtitle = isAppStore ? "Download on the" : "Get it on";
  const title = isAppStore ? "App Store" : "Google Play";
  const qrTitle = isAppStore ? "iPhone에서 와글 설치" : "Android에서 와글 설치";

  const sizeClasses =
    size === "sm"
      ? "h-11 gap-2 rounded-xl px-3.5"
      : "h-[3.25rem] gap-2.5 rounded-xl px-4";

  const iconClasses = size === "sm" ? "size-[1.375rem] shrink-0" : "size-[1.6875rem] shrink-0";
  const subTextClasses =
    size === "sm"
      ? "text-[0.5625rem] font-medium tracking-wide opacity-90"
      : "text-[0.5625rem] font-medium tracking-wide opacity-90";
  const mainTextClasses =
    size === "sm"
      ? "mt-0.5 text-[0.875rem] font-semibold leading-tight tracking-tight"
      : "mt-0.5 text-base font-semibold leading-tight tracking-tight";

  const themeClasses =
    theme === "light"
      ? "bg-white text-black ring-1 ring-black/15"
      : "bg-black text-white ring-1 ring-white/20";

  const baseClasses = [
    styles.storeBadgeRoot,
    "group/badge relative isolate inline-flex select-none items-center overflow-hidden cursor-pointer",
    "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
    "hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transition-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
    sizeClasses,
    themeClasses,
  ].join(" ");

  const innerContent = (
    <>
      <span
        aria-hidden="true"
        className={`${styles.sheenSweep} ${theme === "light" ? styles.sheenLight : styles.sheenDark}`}
      />
      {isAppStore ? (
        <AppleLogo className={iconClasses} />
      ) : (
        <GooglePlayLogo className={iconClasses} />
      )}
      <span className="flex flex-col items-start leading-none">
        <span className={subTextClasses}>{subtitle}</span>
        <span className={mainTextClasses}>{title}</span>
      </span>
    </>
  );

  const showQrPopover = qr && Boolean(href);

  return (
    <div className="group/qr relative inline-flex">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${title}에서 와글 다운로드`}
          className={baseClasses}
        >
          {innerContent}
        </a>
      ) : (
        <button
          type="button"
          onClick={() => onUnavailableClick?.(store)}
          aria-label={`${title} 출시 안내 보기`}
          className={baseClasses}
        >
          {innerContent}
        </button>
      )}

      {showQrPopover && href ? (
        <div
          className={[
            "pointer-events-none absolute bottom-full left-1/2 z-40 mb-3 hidden w-48 -translate-x-1/2",
            "lg:block",
            "translate-y-2 scale-95 opacity-0 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
            "group-hover/qr:pointer-events-auto group-hover/qr:translate-y-0 group-hover/qr:scale-100 group-hover/qr:opacity-100",
            "group-focus-within/qr:pointer-events-auto group-focus-within/qr:translate-y-0 group-focus-within/qr:scale-100 group-focus-within/qr:opacity-100",
            "motion-reduce:transition-none",
          ].join(" ")}
        >
          <div className="rounded-2xl border border-border-subtle bg-surface p-3 text-center shadow-xl">
            <p className="text-xs font-bold text-ink">{qrTitle}</p>
            <div className="mt-2">
              <StoreQrCode url={href} />
            </div>
            <p className="mt-2 text-2xs text-ink-muted">휴대폰 카메라로 스캔하세요</p>
          </div>
          <span
            aria-hidden="true"
            className="mx-auto -mt-1.5 block size-3 rotate-45 border-b border-r border-border-subtle bg-surface"
          />
        </div>
      ) : null}
    </div>
  );
}

export interface StoreBadgeButtonsProps {
  size?: StoreBadgeSize;
  theme?: StoreBadgeTheme;
  qr?: boolean;
  align?: "left" | "center";
}

export function StoreBadgeButtons({
  size = "md",
  theme = "dark",
  qr = false,
  align = "left",
}: StoreBadgeButtonsProps) {
  const [noticeStore, setNoticeStore] = useState<StoreKind | null>(null);

  return (
    <div className={align === "center" ? "flex flex-col items-center" : "flex flex-col items-start"}>
      <div
        className={[
          "flex flex-wrap items-center gap-3",
          align === "center" ? "justify-center" : "justify-start",
        ].join(" ")}
      >
        <StoreBadge
          store="app-store"
          href={IOS_STORE_URL || undefined}
          theme={theme}
          size={size}
          qr={qr}
          onUnavailableClick={(s) => setNoticeStore(s)}
        />
        <StoreBadge
          store="google-play"
          href={ANDROID_STORE_URL || undefined}
          theme={theme}
          size={size}
          qr={qr}
          onUnavailableClick={(s) => setNoticeStore(s)}
        />
      </div>

      {noticeStore ? (
        <div
          role="status"
          className="animate-fade-in mt-3 flex w-full max-w-md items-start gap-2.5 rounded-2xl border border-border-subtle bg-surface p-3.5 text-left shadow-sm"
        >
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Smartphone className="size-4" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-bold text-ink">
              {noticeStore === "app-store" ? "iOS App Store" : "Android Google Play"} 앱 심사 준비 중
            </p>
            <p className="text-2xs leading-relaxed text-ink-muted">
              정식 스토어 오픈 전에도 지금 바로 웹앱에서 동일한 교육·데일리 기록 기능을 이용하실 수 있어요.
            </p>
            <Link
              href="/app"
              className="inline-flex items-center gap-1 pt-0.5 text-xs font-bold text-brand hover:underline"
            >
              와글 웹앱 바로 시작하기
              <ArrowRight className="size-3.5" strokeWidth={2.2} />
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setNoticeStore(null)}
            aria-label="안내 닫기"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
