"use client";

import { createContext, useContext, type ReactNode } from "react";

export type UpdateEdgeLabelFn = (edgeId: string, label: string) => void;
export type UpdateEdgeLabelPositionFn = (
  edgeId: string,
  offsetX: number,
  offsetY: number
) => void;

type EdgeLabelContextValue = {
  updateEdgeLabel: UpdateEdgeLabelFn;
  updateEdgeLabelPosition: UpdateEdgeLabelPositionFn;
};

const EdgeLabelContext = createContext<EdgeLabelContextValue | null>(null);

export function EdgeLabelProvider({
  children,
  updateEdgeLabel,
  updateEdgeLabelPosition,
}: {
  children: ReactNode;
  updateEdgeLabel: UpdateEdgeLabelFn;
  updateEdgeLabelPosition: UpdateEdgeLabelPositionFn;
}): React.ReactElement {
  return (
    <EdgeLabelContext.Provider
      value={{ updateEdgeLabel, updateEdgeLabelPosition }}
    >
      {children}
    </EdgeLabelContext.Provider>
  );
}

export function useUpdateEdgeLabel(): UpdateEdgeLabelFn | null {
  const ctx = useContext(EdgeLabelContext);
  return ctx?.updateEdgeLabel ?? null;
}

export function useUpdateEdgeLabelPosition(): UpdateEdgeLabelPositionFn | null {
  const ctx = useContext(EdgeLabelContext);
  return ctx?.updateEdgeLabelPosition ?? null;
}
