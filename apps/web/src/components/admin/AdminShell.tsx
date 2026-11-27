"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  Coins,
  Database,
  ExternalLink,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  Package,
  PanelLeft,
  Receipt,
  Settings2,
  Shield,
  SlidersHorizontal,
  Star,
  Sun,
  Tags,
  Truck,
  UserCheck,
  Users,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { MENU_REGISTRY, type AdminRole, type AdminSidebarMenuItem } from "@repo/types";
import { cn, WaggleMark } from "@repo/ui";
import { adminLogoutAction } from "@/03_actions/admin/adminAuthActions";

const ADMIN_ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  BookOpen,
  SlidersHorizontal,
  MessageSquareText,
  UserCheck,
  Package,
  Truck,
  Bell,
  Settings2,
  Tags,
  Shield,
  History,
  Video,
  Receipt,
  Coins,
  Star,
};

const ADMIN_ICON_COLOR_MAP: Record<string, string> = {
  Users: "text-info",
  MessageSquareText: "text-info",
  Truck: "text-info",
  BookOpen: "text-positive",
  Coins: "text-positive",
  Package: "text-positive",
  UserCheck: "text-warning",
  SlidersHorizontal: "text-warning",
  Star: "text-warning",
  History: "text-negative",
  Shield: "text-negative",
};

const SIDEBAR_STORAGE_KEY = "waggle-admin-sidebar-collapsed";
const ADMIN_THEME_STORAGE_KEY = "waggle-admin-theme";

interface AdminShellProps {
  dbConnected: boolean;
  dbLabel: string;
  admin: { name: string; email: string; role: AdminRole } | null;
  children: ReactNode;
}

/**
 * ERP Atlas Precision Studio v2.6.0 T-Hairline 레이아웃 쉘
 * - 사이드바 내부 가로선 0개 (atlas-border-r + 우측 헤더 atlas-border-b 2선만 교차)
 * - 헤더/사이드바 모든 아이콘 버튼 무보더(Borderless Ghost) + stroke-[1.5]
 * - PanelLeft 접기/펼치기(Ctrl+B + localStorage) + md+ 아이콘 레일 + 0ms 테마 복원
 */
export function AdminShell({ dbConnected, dbLabel, admin, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  // 초기 테마 + 반응형 사이드바 상태 동기화 (md: 기본 접힘 레일 / lg+: localStorage 복원)
  useEffect(() => {
    const currentTheme = document.documentElement.getAttribute("data-admin-theme");
    setTheme(currentTheme === "light" ? "light" : "dark");
    setMounted(true);

    const mq = window.matchMedia("(min-width: 1024px)");
    const syncByViewport = (isLg: boolean) => {
      if (!isLg) {
        setCollapsed(true);
        return;
      }
      try {
        setCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
      } catch {
        setCollapsed(false);
      }
    };
    syncByViewport(mq.matches);
    const onChange = (e: MediaQueryListEvent) => syncByViewport(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        if (window.matchMedia("(min-width: 1024px)").matches) {
          localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
        }
      } catch {
        // 스토리지 접근 불가 무시
      }
      return next;
    });
  }, []);

  // Ctrl+B / Cmd+B 사이드바 토글 단축키
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleToggleSidebar();
      } else if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleToggleSidebar, mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // /admin/login 화면은 사이드바/헤더 없는 독립 인증 쉘
  if (pathname === "/admin/login" || !admin) {
    return <div className="min-h-dvh bg-base-1 text-neutral">{children}</div>;
  }

  const handleToggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-admin-theme", next);
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem(ADMIN_THEME_STORAGE_KEY, next);
    } catch {
      // 스토리지 접근 불가 무시
    }
  };

  const handleLogout = async () => {
    setMobileOpen(false);
    await adminLogoutAction();
    router.push("/admin/login");
    router.refresh();
  };

  const adminMenus: readonly AdminSidebarMenuItem[] = MENU_REGISTRY.adminSidebar;
  const visibleMenus = adminMenus.filter((item) => item.roles.includes(admin.role));

  const groupedSections = visibleMenus.reduce<
    Array<{ section: string; items: AdminSidebarMenuItem[] }>
  >((acc, item) => {
    const existing = acc.find((group) => group.section === item.section);
    if (existing) existing.items.push(item);
    else acc.push({ section: item.section, items: [item] });
    return acc;
  }, []);

  const currentMenu =
    [...visibleMenus]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ??
    visibleMenus[0];

  const homeHref = admin.role === "TRAINER" ? "/admin/trainer" : "/admin/dashboard";

  const renderSidebarBody = (isMobileDrawer: boolean) => {
    const isCollapsed = isMobileDrawer ? false : collapsed;
    return (
      <>
        {/* 상단 브랜드 영역 (내부 가로 보더 없음 · 무박스 모노톤 심볼) */}
        <div className="flex h-12 shrink-0 items-center justify-between overflow-hidden px-2">
          <Link
            href={homeHref}
            onClick={() => setMobileOpen(false)}
            title="Waggle Admin"
            aria-label="Waggle Admin 홈"
            className="flex h-8 min-w-0 flex-1 items-center gap-2.5 overflow-hidden rounded-nav-item px-1.5 text-sm font-semibold tracking-tight text-neutral transition-colors hover:bg-[var(--mix-hover-subtle)]"
          >
            <WaggleMark className="size-5 shrink-0 text-neutral" />
            <span
              aria-hidden={isCollapsed || undefined}
              className={cn(
                "min-w-0 flex-1 truncate whitespace-nowrap transition-opacity duration-150",
                isCollapsed ? "pointer-events-none opacity-0" : "opacity-100",
              )}
            >
              Waggle Admin
            </span>
          </Link>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="메뉴 닫기"
              className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-btn-sm text-secondary transition-colors hover:bg-[var(--mix-hover-subtle)] hover:text-neutral"
            >
              <X className="size-4 stroke-[1.5]" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {/* 사이드바 내비게이션 (ERP v2.6.0 rounded-nav-item · stroke-[1.5] · 시맨틱 컬러) */}
        <nav
          aria-label="관리자 사이드바"
          className="flex-1 overflow-y-auto overflow-x-hidden px-2 pt-3 pb-3"
        >
          <div className="space-y-5">
            {groupedSections.map((group, sectionIndex) => (
              <div key={group.section}>
                <div className="relative flex h-5 items-center px-2">
                  <span
                    aria-hidden={isCollapsed || undefined}
                    className={cn(
                      "whitespace-nowrap text-xs font-semibold leading-4 text-subdued transition-opacity duration-150",
                      isCollapsed ? "pointer-events-none opacity-0" : "opacity-100",
                    )}
                  >
                    {group.section}
                  </span>
                  {sectionIndex > 0 ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none absolute top-1/2 left-1.5 h-px w-5 -translate-y-1/2 bg-hairline transition-opacity duration-150",
                        isCollapsed ? "opacity-100" : "opacity-0",
                      )}
                    />
                  ) : null}
                </div>

                <ul className="mt-1 space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = ADMIN_ICON_MAP[item.icon] ?? LayoutDashboard;
                    const iconColor = ADMIN_ICON_COLOR_MAP[item.icon] ?? "text-nav";
                    const isActive = currentMenu?.code === item.code;

                    return (
                      <li key={item.code}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          title={isCollapsed ? `${item.code} ${item.label}` : undefined}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex h-8 w-full items-center gap-2.5 overflow-hidden rounded-nav-item px-1.75 text-sm font-[450] leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                            isActive
                              ? "bg-[var(--mix-active-subtle)] font-medium text-neutral"
                              : "text-nav hover:bg-[var(--mix-hover-subtle)] hover:text-neutral",
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-4.5 shrink-0 stroke-[1.5]",
                              iconColor,
                              isActive && iconColor === "text-nav" && "text-neutral",
                            )}
                            aria-hidden="true"
                          />
                          <span
                            aria-hidden={isCollapsed || undefined}
                            className={cn(
                              "min-w-0 flex-1 truncate whitespace-nowrap transition-opacity duration-150",
                              isCollapsed ? "pointer-events-none opacity-0" : "opacity-100",
                            )}
                          >
                            {item.label}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* 하단 프로필 푸터 (가로 보더·카드 박스 제거, ERP 1줄 컴팩트 스타일) */}
        <div className="shrink-0 overflow-hidden px-2 py-2.5">
          <div className="flex h-11 items-center gap-2.5 overflow-hidden rounded-nav-item px-0.5">
            <button
              type="button"
              onClick={handleLogout}
              aria-label="로그아웃"
              title={isCollapsed ? `${admin.name} · 로그아웃` : admin.name}
              className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-btn-sm bg-base-2 text-xs font-semibold text-neutral transition-colors hover:bg-[var(--mix-active-subtle)] hover:text-negative"
            >
              {isCollapsed ? (
                <LogOut className="size-4 stroke-[1.5]" aria-hidden="true" />
              ) : (
                admin.name.slice(0, 1)
              )}
            </button>
            <div
              aria-hidden={isCollapsed || undefined}
              className={cn(
                "flex min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden transition-opacity duration-150",
                isCollapsed ? "pointer-events-none opacity-0" : "opacity-100",
              )}
            >
              <div className="min-w-0">
                <p className="truncate whitespace-nowrap text-xs font-medium text-neutral">
                  {admin.name}
                </p>
                <p className="truncate whitespace-nowrap font-mono text-badge text-subdued">
                  {admin.role}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="로그아웃"
                title="로그아웃"
                tabIndex={isCollapsed ? -1 : 0}
                className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-btn-sm text-secondary transition-colors hover:bg-[var(--mix-active-subtle)] hover:text-negative"
              >
                <LogOut className="size-4 stroke-[1.5]" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };

  const themeLabel = mounted && theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환";

  return (
    <div className="flex min-h-dvh w-full bg-base-1 text-neutral">
      {/* Desktop & Tablet Always-Visible Left Sidebar (md+: 768px+) */}
      <aside
        className={cn(
          "hidden md:sticky md:top-0 md:z-30 md:flex md:h-dvh md:shrink-0 md:flex-col overflow-hidden bg-base-1 atlas-border-r transition-[width] duration-150 ease-out",
          collapsed ? "w-12" : "w-60",
        )}
      >
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile Slide-Over Drawer (< md) */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-50 flex md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="관리자 내비게이션 메뉴"
        >
          <div
            className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex h-dvh w-64 max-w-[82vw] flex-col bg-base-1 shadow-2xl atlas-border-r">
            {renderSidebarBody(true)}
          </aside>
        </div>
      ) : null}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Sticky Header (Atlas T-Hairline + 무보더 아이콘 버튼) */}
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-2 bg-base-1/90 px-3 sm:px-4 backdrop-blur-md atlas-border-b">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {/* Mobile <md Hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="사이드바 메뉴 열기"
              className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-btn-sm text-neutral atlas-border transition-colors hover:bg-[var(--mix-hover-subtle)] md:hidden"
            >
              <Menu className="size-4 stroke-[1.5]" aria-hidden="true" />
            </button>

            {/* Desktop md+ Sidebar Collapse Trigger (무보더 ghost) */}
            <button
              type="button"
              onClick={handleToggleSidebar}
              aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
              title={collapsed ? "사이드바 펼치기 (Ctrl+B)" : "사이드바 접기 (Ctrl+B)"}
              className="hidden md:inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-btn-sm text-secondary transition-colors hover:bg-[var(--mix-hover-subtle)] hover:text-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <PanelLeft className="size-4 stroke-[1.5]" aria-hidden="true" />
            </button>

            <span className="shrink-0 whitespace-nowrap rounded-badge bg-[var(--mix-tint)] px-1.5 py-0.5 font-mono text-xs font-medium text-secondary">
              {currentMenu?.code ?? "ADM"}
            </span>
            <span className="min-w-0 truncate text-sm font-semibold text-neutral">
              {currentMenu?.label ?? "운영 콘솔"}
            </span>
          </div>

          {/* 우측 유틸리티 (ERP 스타일: 전원 무보더 ghost 아이콘/링크) */}
          <div className="flex shrink-0 items-center gap-1">
            <span
              className={cn(
                "hidden lg:inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-badge px-2 font-mono text-xs font-medium tabular-nums",
                dbConnected
                  ? "bg-[color-mix(in_oklab,var(--text-positive)_12%,transparent)] text-positive"
                  : "bg-[color-mix(in_oklab,var(--text-negative)_13%,transparent)] text-negative",
              )}
            >
              <Database className="size-3.5 shrink-0 stroke-[1.5]" aria-hidden="true" />
              {dbLabel}
            </span>

            <span
              className="mx-1 hidden h-4 w-px shrink-0 bg-hairline lg:block"
              aria-hidden="true"
            />

            <Link
              href="/"
              title="사용자 소개 페이지"
              className="hidden sm:inline-flex h-7 items-center gap-1 rounded-btn-sm px-2 text-xs text-secondary transition-colors hover:bg-[var(--mix-hover-subtle)] hover:text-neutral"
            >
              <span>www</span>
              <ExternalLink className="size-3 stroke-[1.5]" aria-hidden="true" />
            </Link>
            <Link
              href="/app"
              title="사용자 웹앱"
              className="hidden sm:inline-flex h-7 items-center gap-1 rounded-btn-sm px-2 text-xs text-secondary transition-colors hover:bg-[var(--mix-hover-subtle)] hover:text-neutral"
            >
              <span>app</span>
              <ExternalLink className="size-3 stroke-[1.5]" aria-hidden="true" />
            </Link>

            {/* 무보더 순수 아이콘 테마 토글 (ERP ThemeToggle 동일 스펙) */}
            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label={themeLabel}
              title={themeLabel}
              className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-btn-sm text-secondary transition-colors hover:bg-[var(--mix-hover-subtle)] hover:text-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {mounted && theme === "dark" ? (
                <Sun className="size-4 stroke-[1.5]" aria-hidden="true" />
              ) : (
                <Moon className="size-4 stroke-[1.5]" aria-hidden="true" />
              )}
            </button>
          </div>
        </header>

        {/* ERP PageContainer 감각의 여유 있는 콘텐츠 영역 */}
        <main className="min-w-0 flex-1 overflow-x-clip">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
