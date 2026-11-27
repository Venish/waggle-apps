"use client";

import { useEffect, useState } from "react";
import { Check, Moon, Palette } from "lucide-react";
import { cn } from "@repo/ui";
import {
  applyWebMode,
  applyWebTheme,
  DEFAULT_WEB_MODE,
  DEFAULT_WEB_THEME,
  readCurrentWebMode,
  readCurrentWebTheme,
  WEB_THEMES,
  type WebMode,
  type WebThemeId,
} from "@/00_lib/webTheme";

/**
 * 마이페이지(/app/my) 인라인 다크 모드 스위치 + 4색 브랜드 테마 스위처
 * - localStorage 0ms 즉시 전환 (기본: 라이트 + 와글 오렌지)
 */
export function WebThemePickerClient() {
  const [theme, setTheme] = useState<WebThemeId>(DEFAULT_WEB_THEME);
  const [mode, setMode] = useState<WebMode>(DEFAULT_WEB_MODE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readCurrentWebTheme());
    setMode(readCurrentWebMode());
    setMounted(true);
  }, []);

  const currentTheme = WEB_THEMES.find((t) => t.id === theme) ?? WEB_THEMES[0]!;
  const isDark = mounted && mode === "dark";

  const handleToggleDark = () => {
    const nextMode: WebMode = isDark ? "light" : "dark";
    setMode(nextMode);
    applyWebMode(nextMode);
  };

  const handleSelectTheme = (nextTheme: WebThemeId) => {
    setTheme(nextTheme);
    applyWebTheme(nextTheme);
  };

  return (
    <div className="divide-y divide-border-subtle">
      {/* 1행: 다크 모드 ON/OFF 토글 스위치 */}
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        onClick={handleToggleDark}
        className="group flex w-full items-center justify-between gap-3 py-4 text-left transition-opacity active:opacity-80"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <Moon className="size-5 shrink-0 text-ink" strokeWidth={1.8} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">다크 모드</p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {isDark ? "어두운 화면 사용 중" : "밝은 화면 사용 중"}
            </p>
          </div>
        </div>

        <span
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200",
            isDark ? "bg-brand" : "bg-ink/[0.12] group-hover:bg-ink/[0.17]",
          )}
        >
          <span
            className={cn(
              "h-5 w-5 rounded-full bg-white shadow-xs transition-[transform,width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-active:w-6",
              isDark ? "translate-x-5 group-active:translate-x-4" : "translate-x-0",
            )}
          />
        </span>
      </button>

      {/* 2행: 브랜드 컬러 4색 스와치 */}
      <div className="flex items-center justify-between gap-3 py-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <Palette className="size-5 shrink-0 text-ink" strokeWidth={1.8} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">앱 테마</p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {mounted ? currentTheme.label : WEB_THEMES[0]!.label}
            </p>
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="앱 테마 색상 선택"
          className="flex shrink-0 items-center gap-2"
        >
          {WEB_THEMES.map((opt) => {
            const active = mounted ? theme === opt.id : opt.id === DEFAULT_WEB_THEME;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${opt.label} 테마`}
                title={opt.label}
                onClick={() => handleSelectTheme(opt.id)}
                style={{ backgroundColor: opt.swatch }}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-white transition-transform duration-150 active:scale-90",
                  active
                    ? "ring-2 ring-ink ring-offset-2 ring-offset-surface"
                    : "opacity-85 hover:opacity-100",
                )}
              >
                {active && <Check className="size-3.5" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
