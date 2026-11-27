"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { WaggleWordmark } from "@repo/ui";
import { useWwwScroll } from "./WwwScrollProvider";

const NAV_ITEMS = [
  { id: "about", label: "공감 체크" },
  { id: "features", label: "핵심 기능" },
  { id: "courses", label: "커리큘럼" },
  { id: "faq", label: "FAQ" },
  { id: "download", label: "앱 설치" },
] as const;

export function WwwHeader() {
  const { scrollTo } = useWwwScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        setScrolled(currentY > 24);
        if (currentY > 220 && currentY > lastY + 8 && !menuOpen) {
          setHidden(true);
        } else if (currentY < lastY - 6 || currentY <= 120) {
          setHidden(false);
        }
        lastY = currentY;
        ticking = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [menuOpen]);

  useEffect(() => {
    const sections = NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) {
          setActiveSection(visible.target.id);
        }
      },
      { rootMargin: "-28% 0px -52% 0px", threshold: [0.1, 0.3, 0.6] },
    );

    sections.forEach((sec) => observer.observe(sec));
    return () => observer.disconnect();
  }, []);

  const handleNavClick = (id: string) => {
    setMenuOpen(false);
    setActiveSection(id);
    scrollTo(`#${id}`, -72);
  };

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-50 transition-[transform,background-color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        hidden ? "-translate-y-full" : "translate-y-0",
        scrolled || menuOpen
          ? "border-b border-border-subtle bg-surface/85 backdrop-blur-2xl"
          : "border-b border-transparent bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            setActiveSection("");
            scrollTo(0);
          }}
          aria-label="와글 최상단으로 이동"
          className="flex cursor-pointer items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <WaggleWordmark className="h-8 w-auto text-brand" />
        </button>

        {/* Desktop Navigation Anchors (Deep Ink Black) */}
        <nav aria-label="주요 섹션 이동" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={[
                  "relative cursor-pointer rounded-xl px-3.5 py-2 text-sm font-bold transition-colors",
                  isActive ? "text-brand" : "text-ink hover:text-brand",
                ].join(" ")}
              >
                {item.label}
                <span
                  aria-hidden="true"
                  className={[
                    "absolute bottom-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-brand transition-[opacity,transform] duration-200",
                    isActive ? "scale-100 opacity-100" : "scale-0 opacity-0",
                  ].join(" ")}
                />
              </button>
            );
          })}
        </nav>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={menuOpen}
          className="inline-flex size-10 items-center justify-center rounded-xl text-ink transition-colors hover:bg-surface-subtle md:hidden"
        >
          {menuOpen ? <X className="size-5" strokeWidth={2} /> : <Menu className="size-5" strokeWidth={2} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {menuOpen ? (
        <div className="animate-fade-in border-t border-border-subtle bg-surface/95 px-4 pb-5 pt-3 backdrop-blur-2xl md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={[
                    "flex items-center justify-between rounded-2xl px-4 py-3 text-left text-base font-bold transition-colors",
                    isActive
                      ? "bg-brand-soft text-brand"
                      : "text-ink hover:bg-surface-subtle",
                  ].join(" ")}
                >
                  <span>{item.label}</span>
                  {isActive ? <span className="size-2 rounded-full bg-brand" /> : null}
                </button>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
