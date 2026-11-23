import type { ReactNode } from "react";
import { cn } from "@repo/ui";

export interface AppSheetFrameProps {
  header?: ReactNode;
  headerMode?: "fixed" | "flow";
  subHeader?: ReactNode;
  children: ReactNode;
  align?: "top" | "center";
  noPadding?: boolean;
  bottom?: ReactNode;
  bottomMode?: "flow" | "fixed";
  className?: string;
  contentClassName?: string;
  bottomClassName?: string;
}

export function AppSheetFrame({
  header,
  headerMode = "fixed",
  subHeader,
  children,
  align = "top",
  noPadding = false,
  bottom,
  bottomMode = "flow",
  className,
  contentClassName,
  bottomClassName,
}: AppSheetFrameProps) {
  return (
    <div className={cn("flex h-full min-h-dvh w-full flex-col bg-canvas text-ink", className)}>
      {headerMode === "fixed" && (header || subHeader) && (
        <div className="sticky top-0 z-20 shrink-0 bg-canvas/90 backdrop-blur-md pt-safe-top">
          {header}
          {subHeader}
        </div>
      )}

      <main
        className={cn(
          "min-h-0 flex-1 overflow-y-auto no-scrollbar",
          !noPadding && "px-4 py-4",
          align === "center" && "flex flex-col items-center justify-center",
          bottomMode === "fixed" && bottom && "pb-24",
          contentClassName,
        )}
      >
        {headerMode === "flow" && (
          <>
            {header}
            {subHeader}
          </>
        )}
        {children}
      </main>

      {bottom && (
        <div
          className={cn(
            "z-20 shrink-0 bg-canvas/90 px-4 pt-3 backdrop-blur-md pb-safe-bottom",
            bottomMode === "fixed" && "absolute inset-x-0 bottom-0",
            bottomClassName,
          )}
        >
          {bottom}
        </div>
      )}
    </div>
  );
}
