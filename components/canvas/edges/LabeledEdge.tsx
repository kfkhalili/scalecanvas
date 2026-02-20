"use client";

import { useState, useRef, useEffect } from "react";
import {
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from "reactflow";
import { useUpdateEdgeLabel } from "./EdgeLabelContext";

const LABEL_PLACEHOLDER = "label";

export function LabeledEdge({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps): React.ReactElement {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const [isEditing, setIsEditing] = useState(false);
  const label = (data?.label as string) ?? "";
  const [value, setValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateEdgeLabel = useUpdateEdgeLabel();

  useEffect(() => {
    if (!isEditing) setValue(label);
  }, [label, isEditing]);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleSave = (): void => {
    setIsEditing(false);
    const trimmed = value.trim();
    if (updateEdgeLabel) updateEdgeLabel(id, trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setValue(label);
      setIsEditing(false);
      inputRef.current?.blur();
    }
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            minWidth: isEditing ? 32 : 24,
            minHeight: isEditing ? 28 : 20,
          }}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="rounded border border-input bg-background px-2 py-1 text-xs text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              style={{ width: Math.max(56, value.length * 8) }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setValue(label);
                setIsEditing(true);
              }}
              className="rounded px-1.5 py-0.5 text-xs text-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {label || LABEL_PLACEHOLDER}
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
