"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  Coins,
  Database,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
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

interface AdminShellProps {
  dbConnected: boolean;
  dbLabel: string;
  admin: { name: string; email: string; role: AdminRole } | null;
  children: ReactNode;
}

export function AdminShell({ dbConnected, dbLabel, admin, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  // /admin/login 화면은 사이드바/헤더 없는 독립 인증 쉘
  if (pathname === "/admin/login" || !admin) {
    return <div className="min-h-dvh bg-base-1 text-neutral">{children}</div>;
  }

  const handleToggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-admin-theme", next);
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
    if (existing) {
      existing.items.push(item);
    } else {
      acc.push({ section: item.section, items: [item] });
    }
    return acc;
  }, []);

  const currentMenu =
    [...visibleMenus]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ??
    visibleMenus[0];

  const renderSidebarBody = (isMobileDrawer: boolean) => {
    const isCollapsed = isMobileDrawer ? false : collapsed;
    return (
      <>
        <div
          className={cn(
            "flex h-12 shrink-0 items-center atlas-border-b",
            isCollapsed ? "justify-center px-2" : "justify-between px-3.5",
          )}
        >
          {!isCollapsed && (
            <Link
              href={admin.role === "TRAINER" ? "/admin/trainer" : "/admin/dashboard"}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2.5 truncate"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-badge bg-inverse text-on-inverse">
                <WaggleMark className="h-3.5 w-auto" />
              </span>
              <span className="truncate text-sm font-medium tracking-tight text-neutral">
                Waggle Admin
              </span>
            </Link>
          )}
          {isMobileDrawer ? (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="메뉴 닫기"
              className="flex size-7 items-center justify-center rounded-btn-sm text-secondary transition-colors hover:bg-[var(--mix-hover-subtle)] hover:text-neutral"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
              className="flex size-7 items-center justify-center rounded-btn-sm text-secondary transition-colors hover:bg-[var(--mix-hover-subtle)] hover:text-neutral"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" strokeWidth={1.75} />
              ) : (
                <PanelLeftClose className="size-4" strokeWidth={1.75} />
              )}
            </button>
          )}
        </div>

        <nav aria-label="관리자 사이드바" className="flex-1 overflow-y-auto p-2">
          <div className="space-y-3">
            {groupedSections.map((group) => (
              <div key={group.section}>
                {isCollapsed ? (
                  <div className="mx-auto my-2 h-px w-5 bg-hairline" />
                ) : (
                  <div className="flex h-5 items-center px-2 py-0.5 text-xs font-semibold leading-4 text-secondary">
                    {group.section}
                  </div>
                )}

                <ul className="mt-1 space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = ADMIN_ICON_MAP[item.icon] ?? LayoutDashboard;
                    const isActive = currentMenu?.code === item.code;

                    return (
                      <li key={item.code}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          title={isCollapsed ? `${item.code} ${item.label}` : undefined}
                          className={cn(
                            "flex h-8 items-center rounded-btn-sm text-control leading-4 transition-colors",
                            isCollapsed ? "mx-auto w-8 justify-center" : "gap-2.5 px-2",
                            isActive
                              ? "bg-[var(--mix-active-subtle)] font-medium text-neutral"
                              : "text-secondary hover:bg-[var(--mix-hover-subtle)] hover:text-neutral",
                          )}
                        >
                          <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                          {!isCollapsed && (
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="shrink-0 p-2 atlas-border-t">
          {isCollapsed ? (
            <button
              type="button"
              onClick={handleLogout}
              title="로그아웃"
              className="mx-auto flex size-8 items-center justify-center rounded-btn-sm text-secondary hover:bg-[var(--mix-hover-subtle)] hover:text-negative"
            >
              <LogOut className="size-4" strokeWidth={1.75} />
            </button>
          ) : (
            <div className="space-y-2 rounded-control bg-base-2 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-neutral">{admin.name}</p>
                  <p className="truncate font-mono text-xs text-subdued">{admin.role}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="로그아웃"
                  className="flex size-7 shrink-0 items-center justify-center rounded-btn-sm text-secondary hover:bg-[var(--mix-hover-subtle)] hover:text-negative"
                >
                  <LogOut className="size-4" strokeWidth={1.75} />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-6 flex-1 items-center justify-center rounded-btn-sm text-xs text-secondary atlas-border hover:text-neutral"
                >
                  www
                </Link>
                <Link
                  href="/app"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-6 flex-1 items-center justify-center rounded-btn-sm text-xs text-secondary atlas-border hover:text-neutral"
                >
                  app
                </Link>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="flex min-h-dvh w-full bg-base-1 text-neutral">
      {/* Desktop Collapsible Sidebar (lg+ 전용) */}
      <aside
        className={cn(
          "hidden lg:sticky lg:top-0 lg:z-30 lg:flex lg:h-dvh lg:shrink-0 lg:flex-col bg-base-1 atlas-border-r transition-[width] duration-200",
          collapsed ? "lg:w-12" : "lg:w-60",
        )}
      >
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile / Tablet Slide-Over Drawer (< lg) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
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
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-2 bg-base-1/90 px-3 sm:px-4 backdrop-blur-md atlas-border-b">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="사이드바 메뉴 열기"
              className="flex size-8 shrink-0 items-center justify-center rounded-control text-neutral atlas-border transition-colors hover:bg-[var(--mix-hover-subtle)] lg:hidden"
            >
              <Menu className="size-4" strokeWidth={1.75} />
            </button>
            <span className="shrink-0 whitespace-nowrap rounded-badge bg-[var(--mix-tint)] px-1.5 py-0.5 font-mono text-xs font-medium text-secondary">
              {currentMenu?.code ?? "ADM"}
            </span>
            <h1 className="min-w-0 truncate text-sm font-semibold text-neutral">
              {currentMenu?.label ?? "운영 콘솔"}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <span
              className={cn(
                "hidden md:inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-badge px-2 font-mono text-xs font-medium tabular-nums",
                dbConnected ? "bg-positive/12 text-positive" : "bg-negative/12 text-negative",
              )}
            >
              <Database className="size-3.5 shrink-0" strokeWidth={1.75} />
              {dbLabel}
            </span>

            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
              className="inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control px-2 sm:px-2.5 text-control font-medium text-neutral atlas-border transition-colors hover:bg-[var(--mix-hover-subtle)]"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="size-4 shrink-0" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="size-4 shrink-0" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-clip p-3 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
