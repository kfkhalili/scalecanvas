"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { whenSome } from "@/lib/optionHelpers";
import {
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer,
  useReactFlow,
  type EdgeProps,
} from "reactflow";
import { useUpdateEdgeLabel, useUpdateEdgeLabelPosition } from "./EdgeLabelContext";

const LABEL_PLACEHOLDER = "label";

const DEFAULT_EDGE_STYLE = { strokeWidth: 4 };

const DRAG_THRESHOLD_PX = 5;

export function LabeledEdge({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
}: EdgeProps): React.ReactElement {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const { getZoom } = useReactFlow();
  const updateEdgeLabel = useUpdateEdgeLabel();
  const updateEdgeLabelPosition = useUpdateEdgeLabelPosition();

  const [isEditing, setIsEditing] = useState(false);
  const label = (data?.label as string | undefined) ?? "";
  const [value, setValue] = useState(label);
  const prevLabelRef = useRef(label);
  if (prevLabelRef.current !== label) {
    prevLabelRef.current = label;
    if (!isEditing) setValue(label);
  }
  const inputRef = useRef<HTMLInputElement>(null);

  const baseOffsetX = (data?.labelOffsetX as number | undefined) ?? 0;
  const baseOffsetY = (data?.labelOffsetY as number | undefined) ?? 0;

  type DragStart = { clientX: number; clientY: number; offsetX: number; offsetY: number };
  const dragStartRef = useRef<DragStart | null>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const displayX = labelX + baseOffsetX + (isDragging ? dragOffset.x : 0);
  const displayY = labelY + baseOffsetY + (isDragging ? dragOffset.y : 0);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleSave = useCallback((): void => {
    setIsEditing(false);
    const trimmed = value.trim();
    whenSome(updateEdgeLabel, (fn) => fn(id, trimmed));
  }, [id, value, updateEdgeLabel]);

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

  const [labelPointerDown, setLabelPointerDown] = useState(false);

  const handleLabelMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isEditing) return;
      e.preventDefault();
      e.stopPropagation();
      dragStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        offsetX: baseOffsetX,
        offsetY: baseOffsetY,
      };
      setDragOffset({ x: 0, y: 0 });
      setLabelPointerDown(true);
    },
    [isEditing, baseOffsetX, baseOffsetY]
  );

  useEffect(() => {
    if (!labelPointerDown) return;

    const onMove = (e: MouseEvent): void => {
      const start = dragStartRef.current;
      if (!start) return;
      const dx = e.clientX - start.clientX;
      const dy = e.clientY - start.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= DRAG_THRESHOLD_PX) {
        if (!isDraggingRef.current) {
          isDraggingRef.current = true;
          setIsDragging(true);
        }
        const zoom = getZoom();
        setDragOffset({ x: dx / zoom, y: dy / zoom });
      }
    };

    const onUp = (e: MouseEvent): void => {
      const start = dragStartRef.current;
      const wasDragging = isDraggingRef.current;
      dragStartRef.current = null;
      isDraggingRef.current = false;
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });

      if (start) {
        if (wasDragging) {
          const zoom = getZoom();
          const nx = start.offsetX + (e.clientX - start.clientX) / zoom;
          const ny = start.offsetY + (e.clientY - start.clientY) / zoom;
          whenSome(updateEdgeLabelPosition, (fn) => fn(id, nx, ny));
        } else {
          setIsEditing(true);
        }
      }
      setLabelPointerDown(false);
    };

    const doc = document;
    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseup", onUp);
    return () => {
      doc.removeEventListener("mousemove", onMove);
      doc.removeEventListener("mouseup", onUp);
    };
  }, [labelPointerDown, getZoom, id, updateEdgeLabelPosition]);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ ...DEFAULT_EDGE_STYLE, ...style }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${displayX}px,${displayY}px)`,
            pointerEvents: "all",
            minWidth: isEditing ? 32 : 24,
            minHeight: isEditing ? 28 : 20,
            cursor: isEditing ? "text" : isDragging ? "grabbing" : "grab",
          }}
          onMouseDown={handleLabelMouseDown}
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
