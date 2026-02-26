"use client";

import { Option } from "effect";
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

const EdgeLabelContext = createContext<Option.Option<EdgeLabelContextValue>>(Option.none());

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
      value={Option.some({ updateEdgeLabel, updateEdgeLabelPosition })}
    >
      {children}
    </EdgeLabelContext.Provider>
  );
}

export function useUpdateEdgeLabel(): Option.Option<UpdateEdgeLabelFn> {
  const ctx = useContext(EdgeLabelContext);
  return Option.map(ctx, (c) => c.updateEdgeLabel);
}

export function useUpdateEdgeLabelPosition(): Option.Option<UpdateEdgeLabelPositionFn> {
  const ctx = useContext(EdgeLabelContext);
  return Option.map(ctx, (c) => c.updateEdgeLabelPosition);
}
