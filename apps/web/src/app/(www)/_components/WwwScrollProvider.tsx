"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import styles from "../landing.module.css";

gsap.registerPlugin(ScrollTrigger);

interface WwwScrollContextValue {
  scrollTo: (target: string | number, offset?: number) => void;
}

const WwwScrollContext = createContext<WwwScrollContextValue>({
  scrollTo: () => {},
});

export function useWwwScroll() {
  return useContext(WwwScrollContext);
}

export function WwwScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateProgressBar = () => {
      const bar = progressBarRef.current;
      if (!bar) return;
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      bar.style.transform = `scaleX(${progress.toFixed(4)})`;
    };

    const desktopMotionQuery = window.matchMedia(
      "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );

    let activeLenis: Lenis | null = null;
    let onTick: ((time: number) => void) | null = null;

    const mountLenis = () => {
      if (activeLenis || !desktopMotionQuery.matches) return;

      const lenis = new Lenis({
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        syncTouch: false,
      });

      lenis.on("scroll", () => {
        ScrollTrigger.update();
        updateProgressBar();
      });

      onTick = (time: number) => {
        lenis.raf(time * 1000);
      };

      gsap.ticker.add(onTick);
      gsap.ticker.lagSmoothing(0);

      activeLenis = lenis;
      lenisRef.current = lenis;
    };

    const unmountLenis = () => {
      if (onTick) {
        gsap.ticker.remove(onTick);
        onTick = null;
      }
      if (activeLenis) {
        activeLenis.destroy();
        activeLenis = null;
      }
      lenisRef.current = null;
    };

    mountLenis();
    updateProgressBar();

    const handleNativeScroll = () => {
      if (!activeLenis) {
        updateProgressBar();
      }
    };

    const handleMediaChange = () => {
      if (desktopMotionQuery.matches) {
        mountLenis();
      } else {
        unmountLenis();
      }
      ScrollTrigger.refresh();
    };

    window.addEventListener("scroll", handleNativeScroll, { passive: true });
    desktopMotionQuery.addEventListener("change", handleMediaChange);

    let disposed = false;
    const refreshAfterFonts = () => {
      if (!disposed) {
        ScrollTrigger.refresh();
        updateProgressBar();
      }
    };
    void document.fonts?.ready.then(refreshAfterFonts);
    const timer = window.setTimeout(refreshAfterFonts, 350);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.removeEventListener("scroll", handleNativeScroll);
      desktopMotionQuery.removeEventListener("change", handleMediaChange);
      unmountLenis();
    };
  }, []);

  const scrollTo = useCallback((target: string | number, offset = -72) => {
    const lenis = lenisRef.current;
    if (lenis) {
      if (typeof target === "number") {
        lenis.scrollTo(target, { duration: 1.05 });
      } else {
        const el = document.querySelector<HTMLElement>(target);
        if (el) {
          lenis.scrollTo(el, { offset, duration: 1.1 });
        }
      }
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";

    if (typeof target === "number") {
      window.scrollTo({ top: target, behavior });
      return;
    }

    const el = document.querySelector<HTMLElement>(target);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top: Math.max(0, top), behavior });
  }, []);

  const value = useMemo(() => ({ scrollTo }), [scrollTo]);

  return (
    <WwwScrollContext.Provider value={value}>
      <div className={styles.scrollProgressTrack} aria-hidden="true">
        <div ref={progressBarRef} className={styles.scrollProgressBar} />
      </div>
      <div className={styles.pageRoot}>{children}</div>
    </WwwScrollContext.Provider>
  );
}
