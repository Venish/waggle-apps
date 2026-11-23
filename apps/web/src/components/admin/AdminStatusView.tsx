"use client";

import Link from "next/link";
import { WaggleMark } from "@repo/ui";

interface AdminStatusAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export function AdminStatusView({
  code,
  title,
  description,
  digest,
  primaryAction,
  secondaryAction,
}: {
  code: "404" | "500";
  title: string;
  description: string;
  digest?: string;
  primaryAction: AdminStatusAction;
  secondaryAction?: AdminStatusAction;
}) {
  const isServerError = code === "500";

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] w-full flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex w-full max-w-sm flex-col items-center">
        <div
          className={`atlas-border flex size-20 items-center justify-center rounded-auth bg-base-2 ${
            isServerError ? "text-negative" : "text-neutral"
          }`}
        >
          <WaggleMark className="w-[54%]" />
        </div>

        <p
          className={`mt-6 font-mono text-sm font-bold tracking-widest tabular-nums ${
            isServerError ? "text-negative" : "text-subdued"
          }`}
        >
          {code}
        </p>

        <h1 className="mt-2 text-xl font-bold tracking-tight text-neutral">{title}</h1>

        <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-secondary">{description}</p>

        {digest && (
          <p className="mt-3 rounded-badge bg-base-2 px-2.5 py-1 font-mono text-xs tabular-nums text-subdued">
            digest: {digest}
          </p>
        )}

        <div className="mt-8 flex w-full max-w-[260px] flex-col gap-2">
          {primaryAction.href ? (
            <Link
              href={primaryAction.href}
              className="inline-flex h-10 w-full items-center justify-center rounded-control bg-inverse px-4 text-sm font-semibold text-on-inverse transition-opacity hover:opacity-90 active:scale-[0.99]"
            >
              {primaryAction.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="inline-flex h-10 w-full items-center justify-center rounded-control bg-inverse px-4 text-sm font-semibold text-on-inverse transition-opacity hover:opacity-90 active:scale-[0.99]"
            >
              {primaryAction.label}
            </button>
          )}

          {secondaryAction &&
            (secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className="atlas-border inline-flex h-10 w-full items-center justify-center rounded-control bg-base-2 px-4 text-sm font-semibold text-neutral transition-colors hover:bg-base-3 active:scale-[0.99]"
              >
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="atlas-border inline-flex h-10 w-full items-center justify-center rounded-control bg-base-2 px-4 text-sm font-semibold text-neutral transition-colors hover:bg-base-3 active:scale-[0.99]"
              >
                {secondaryAction.label}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
