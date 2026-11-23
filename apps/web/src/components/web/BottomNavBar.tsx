"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MENU_REGISTRY, type MobileTabMenuItem } from "@repo/types";
import { cn } from "@repo/ui";
import { getMobileRoutePresentation } from "@/00_lib/mobileRoutePresentation";

function TabIcon({ code, active }: { code: MobileTabMenuItem["code"]; active: boolean }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true as const,
    className: "size-5.5",
  };

  switch (code) {
    case "U-01":
      return active ? (
        <svg {...commonProps}>
          <path
            d="M12 4.3a.8.8 0 0 1 .34.08l9.5 4.5a.75.75 0 0 1 0 1.35l-9.5 4.5a.8.8 0 0 1-.68 0l-9.5-4.5a.75.75 0 0 1 0-1.35l9.5-4.5A.8.8 0 0 1 12 4.3Z"
            fill="currentColor"
          />
          <path
            d="M6.2 12.6l5.15 2.44a1.5 1.5 0 0 0 1.3 0l5.15-2.44v3.4c0 1.7-2.6 3.1-5.8 3.1s-5.8-1.4-5.8-3.1v-3.4Z"
            fill="currentColor"
          />
          <path
            d="M20.5 10.5v5.3"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg
          {...commonProps}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 9.5 12 5l9.5 4.5L12 14 2.5 9.5Z" />
          <path d="M6.5 11.4v4.4c0 1.4 2.5 2.7 5.5 2.7s5.5-1.3 5.5-2.7v-4.4" />
          <path d="M20.5 10v5.5" />
        </svg>
      );

    case "U-02":
      return active ? (
        <svg {...commonProps}>
          <circle cx="12" cy="8.8" r="5.8" fill="currentColor" />
          <path
            d="M8.5 15.2a6.9 6.9 0 0 0 7 0l1.1 5.1a.6.6 0 0 1-.86.66L12 19.1l-3.74 1.86a.6.6 0 0 1-.86-.66l1.1-5.1Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg
          {...commonProps}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="9" r="5.5" />
          <path d="M8.8 13.7 7.4 20.5l4.6-2.3 4.6 2.3-1.4-6.8" />
        </svg>
      );

    case "U-03":
      return active ? (
        <svg {...commonProps}>
          <path
            d="M8 2.8v3.2M16 2.8v3.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M3.5 7.8a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v1.3h-17V7.8Z"
            fill="currentColor"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M3.5 10.6h17v6.9a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3v-6.9Zm5 4.9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm3.5 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm4.5-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg
          {...commonProps}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3.5" y="4.8" width="17" height="15.7" rx="3" />
          <path d="M8 3v3.3M16 3v3.3M3.5 9.5h17" />
          <circle cx="8.5" cy="14.2" r="0.85" fill="currentColor" stroke="none" />
          <circle cx="12" cy="14.2" r="0.85" fill="currentColor" stroke="none" />
          <circle cx="15.5" cy="14.2" r="0.85" fill="currentColor" stroke="none" />
        </svg>
      );

    case "U-04":
      return active ? (
        <svg {...commonProps}>
          <path
            d="M8.5 8V6.6a3.5 3.5 0 0 1 7 0V8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M4.5 7.8a.6.6 0 0 1 .6-.55h13.8a.6.6 0 0 1 .6.55l-.95 10.65a2.5 2.5 0 0 1-2.5 2.3H7.95a2.5 2.5 0 0 1-2.5-2.3L4.5 7.8Zm4.55 3.15a.75.75 0 0 1 .75.75 2.2 2.2 0 0 0 4.4 0 .75.75 0 0 1 1.5 0 3.7 3.7 0 0 1-7.4 0 .75.75 0 0 1 .75-.75Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg
          {...commonProps}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.8 8.2h14.4l-.9 10.2a2.2 2.2 0 0 1-2.2 2H7.9a2.2 2.2 0 0 1-2.2-2L4.8 8.2Z" />
          <path d="M8.5 8.2V6.6a3.5 3.5 0 0 1 7 0v1.6" />
        </svg>
      );

    case "U-05":
      return active ? (
        <svg {...commonProps}>
          <circle cx="12" cy="7.6" r="3.9" fill="currentColor" />
          <path
            d="M4.6 19.6c.55-3.6 3.5-5.8 7.4-5.8s6.85 2.2 7.4 5.8a.9.9 0 0 1-.9 1.05H5.5a.9.9 0 0 1-.9-1.05Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg
          {...commonProps}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="7.8" r="3.6" />
          <path d="M5 19.8c.6-3.3 3.4-5.4 7-5.4s6.4 2.1 7 5.4" />
        </svg>
      );
  }
}

/**
 * 플로팅 리퀴드 글래스 5-Tab 하단 바 — Editorial Monochrome + 좌우 슬라이딩 캡슐
 * - 비활성: 가는 1.4px 검정 아웃라인 / 활성: 꽉 찬 검정 Solid SVG + 슬라이딩 캡슐
 * - 라벨은 web.css @theme 선언 토큰(text-3xs) 사용 (임의값 금지)
 * - 5대 대표 탭(ROOT_TAB)에서만 표시, 서브/온보딩/레슨 몰입 화면에서는 자동 숨김
 */
export function BottomNavBar() {
  const pathname = usePathname();
  const { showBottomNav } = getMobileRoutePresentation(pathname);

  if (!showBottomNav) {
    return null;
  }

  const tabs = MENU_REGISTRY.mobileTabs;
  const activeIndex = tabs.findIndex((tab) =>
    tab.href === "/app"
      ? pathname === "/app" || pathname.startsWith("/app/courses")
      : pathname === tab.href || pathname.startsWith(`${tab.href}/`),
  );

  return (
    <div className="pointer-events-none fixed bottom-0 left-1/2 z-30 w-full max-w-app -translate-x-1/2 px-4 pt-2 pb-safe-bottom">
      <nav
        aria-label="하단 주 메뉴"
        className="waggle-liquid-glass pointer-events-auto mb-1 rounded-full px-0.5 py-1"
      >
        <ul className="relative grid grid-cols-5">
          {activeIndex >= 0 && (
            <li
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-1/5 px-0.5 transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: `translateX(${activeIndex * 100}%)` }}
            >
              <span className="block h-full w-full rounded-full bg-ink/[0.075]" />
            </li>
          )}

          {tabs.map((tab, idx) => {
            const isActive = idx === activeIndex;
            return (
              <li key={tab.code} className="px-0.5">
                <Link
                  href={tab.href}
                  className={cn(
                    "relative z-10 flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 transition-colors duration-200 active:scale-[0.96]",
                    isActive
                      ? "text-ink"
                      : "text-ink/55 hover:bg-ink/[0.04] hover:text-ink/85",
                  )}
                >
                  <TabIcon code={tab.code} active={isActive} />
                  <span className="text-3xs font-medium tracking-tight">{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
