"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const MIN_PANEL_PX = 280;

type SplitScreenProps = {
  left: ReactNode;
  right: ReactNode;
  leftClassName?: string;
  rightClassName?: string;
  /** Initial left panel width as fraction 0–1 (default 0.55). */
  defaultLeftRatio?: number;
};

export function SplitScreen({
  left,
  right,
  leftClassName = "min-w-0",
  rightClassName = "min-w-0",
  defaultLeftRatio = 0.55,
}: SplitScreenProps): ReactNode {
  const [leftRatio, setLeftRatio] = useState(defaultLeftRatio);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const width = rect.width;
      const minLeft = MIN_PANEL_PX / width;
      const maxLeft = 1 - MIN_PANEL_PX / width;
      const raw = (e.clientX - rect.left) / width;
      const next = Math.min(maxLeft, Math.max(minLeft, raw));
      setLeftRatio(next);
    };

    const onMouseUp = () => setIsDragging(false);

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  return (
    <div ref={containerRef} className="flex h-full w-full">
      <div
        className={cn(leftClassName, "flex h-full shrink-0 flex-col overflow-hidden")}
        style={{
          width: `${leftRatio * 100}%`,
          minWidth: MIN_PANEL_PX,
        }}
      >
        {left}
      </div>
      <div
        role="separator"
        aria-label="Resize panels"
        tabIndex={0}
        className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
        onMouseDown={handleMouseDown}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            setLeftRatio((r) => Math.max(0.15, r - 0.05));
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            setLeftRatio((r) => Math.min(0.85, r + 0.05));
          }
        }}
      />
      <div
        className={cn(rightClassName, "min-w-0 flex-1 overflow-hidden")}
        style={{ minWidth: MIN_PANEL_PX }}
      >
        {right}
      </div>
    </div>
  );
}
