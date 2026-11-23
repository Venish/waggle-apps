"use client";

import { WaggleMark } from "@repo/ui";
import { AppButton, AppLinkButton } from "@/components/web/ui";

interface StatusAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export function WebStatusView({
  code,
  title,
  description,
  primaryAction,
  secondaryAction,
  fullViewport = false,
}: {
  code: "404" | "500";
  title: string;
  description: string;
  primaryAction: StatusAction;
  secondaryAction?: StatusAction;
  fullViewport?: boolean;
}) {
  const isServerError = code === "500";

  return (
    <div
      className={
        fullViewport
          ? "flex min-h-dvh w-full flex-col items-center justify-center bg-canvas px-6 py-12 text-center"
          : "flex flex-1 flex-col items-center justify-center px-2 py-12 text-center"
      }
    >
      <div className="flex w-full max-w-sm flex-col items-center">
        <div
          className={`waggle-squircle flex size-20 items-center justify-center ${
            isServerError ? "bg-surface-subtle text-ink-muted" : "bg-brand-soft text-brand"
          }`}
        >
          <WaggleMark className="w-[56%]" />
        </div>

        <p
          className={`mt-6 text-sm font-extrabold tracking-widest tabular-nums ${
            isServerError ? "text-ink-muted" : "text-brand-strong"
          }`}
        >
          {code}
        </p>

        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">{title}</h1>

        <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-ink-muted">{description}</p>

        <div className="mt-8 flex w-full max-w-[260px] flex-col gap-2.5">
          {primaryAction.href ? (
            <AppLinkButton href={primaryAction.href} variant="primary" size="lg" fullWidth>
              {primaryAction.label}
            </AppLinkButton>
          ) : (
            <AppButton
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </AppButton>
          )}

          {secondaryAction &&
            (secondaryAction.href ? (
              <AppLinkButton href={secondaryAction.href} variant="secondary" size="lg" fullWidth>
                {secondaryAction.label}
              </AppLinkButton>
            ) : (
              <AppButton
                type="button"
                variant="secondary"
                size="lg"
                fullWidth
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </AppButton>
            ))}
        </div>
      </div>
    </div>
  );
}
