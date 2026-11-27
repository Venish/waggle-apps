"use client";

import dynamic from "next/dynamic";
import type { MutableRefObject } from "react";
import styles from "../landing.module.css";

const WwwHeroNetworkScene = dynamic(
  () => import("./WwwHeroNetworkScene").then((m) => m.WwwHeroNetworkScene),
  { ssr: false },
);

export interface WwwHeroNetworkCanvasProps {
  scrollProgressRef: MutableRefObject<number>;
}

export function WwwHeroNetworkCanvas({ scrollProgressRef }: WwwHeroNetworkCanvasProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden opacity-100"
      aria-hidden="true"
    >
      <WwwHeroNetworkScene scrollProgressRef={scrollProgressRef} />
      {/* Thin bottom edge transition only — keeps entire 3D canvas at crisp opacity: 1 */}
      <div className={`${styles.heroBottomFade} absolute inset-x-0 bottom-0 h-24`} />
    </div>
  );
}
