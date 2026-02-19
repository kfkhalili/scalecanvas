"use client";

import type { ReactNode } from "react";

type SplitScreenProps = {
  left: ReactNode;
  right: ReactNode;
  leftClassName?: string;
  rightClassName?: string;
};

export function SplitScreen({
  left,
  right,
  leftClassName = "min-w-0",
  rightClassName = "min-w-0",
}: SplitScreenProps): ReactNode {
  return (
    <div className="flex h-full w-full">
      <div
        className={leftClassName}
        style={{ width: "55%", minWidth: 280 }}
      >
        {left}
      </div>
      <div
        className={rightClassName}
        style={{ width: "45%", minWidth: 280 }}
      >
        {right}
      </div>
    </div>
  );
}
