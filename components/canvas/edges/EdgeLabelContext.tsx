"use client";

import { createContext, useContext, type ReactNode } from "react";

export type UpdateEdgeLabelFn = (edgeId: string, label: string) => void;

const EdgeLabelContext = createContext<UpdateEdgeLabelFn | null>(null);

export function EdgeLabelProvider({
  children,
  updateEdgeLabel,
}: {
  children: ReactNode;
  updateEdgeLabel: UpdateEdgeLabelFn;
}): React.ReactElement {
  return (
    <EdgeLabelContext.Provider value={updateEdgeLabel}>
      {children}
    </EdgeLabelContext.Provider>
  );
}

export function useUpdateEdgeLabel(): UpdateEdgeLabelFn | null {
  return useContext(EdgeLabelContext);
}
