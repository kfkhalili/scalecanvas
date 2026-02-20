"use client";

import { memo, useCallback, useRef, useEffect, useState } from "react";
import { useReactFlow, type Node, type NodeProps } from "reactflow";
import type { NodeData } from "@/lib/types";

const MIN_TOTAL_WIDTH_PX = 100;
const MIN_ROWS = 2;
const LINE_HEIGHT_APPROX = 20;

type TextBoxNodeProps = NodeProps<NodeData>;

function TextBoxNodeBase({ id, data }: TextBoxNodeProps): React.ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const label = data && typeof data === "object" && "label" in data ? String(data.label) : "";
  const value = label ?? "";

  const [isEditing, setIsEditing] = useState(false);
  const [widthPx, setWidthPx] = useState(MIN_TOTAL_WIDTH_PX);

  const { setNodes } = useReactFlow();
  const updateContent = useCallback(
    (content: string) => {
      setNodes((nodes: Node[]) =>
        nodes.map((n) => {
          if (n.id !== id) return n;
          return { ...n, data: { label: content } satisfies NodeData };
        })
      );
    },
    [id, setNodes]
  );

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const finishEditing = useCallback(() => {
    setIsEditing(false);
  }, []);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const span = measureRef.current;
    if (!span) return;
    setWidthPx((prev) =>
      Math.max(MIN_TOTAL_WIDTH_PX, span.offsetWidth, prev)
    );
  }, [value, isEditing]);

  // Auto-grow textarea height to fit content
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || !isEditing) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.max(ta.scrollHeight, MIN_ROWS * LINE_HEIGHT_APPROX)}px`;
  }, [value, isEditing]);

  const lineCount = value ? value.split("\n").length : 1;
  const readOnlyMinHeight = Math.max(MIN_ROWS * LINE_HEIGHT_APPROX, lineCount * LINE_HEIGHT_APPROX);

  return (
    <div className="min-h-[2rem] cursor-grab rounded-lg border-2 border-border bg-muted/50 shadow-sm dark:bg-muted/30">
      <div className="relative inline-block">
        <span
          ref={measureRef}
          aria-hidden
          className="invisible absolute left-0 top-0 whitespace-pre border-0 border-transparent bg-transparent px-3 py-2 text-sm font-normal"
          style={{ pointerEvents: "none" }}
        >
          {value || "\u00A0"}
        </span>
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className="nodrag nopan block w-full rounded-md border-0 bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-0"
            value={value}
            onChange={(e) => updateContent(e.target.value)}
            onBlur={finishEditing}
            placeholder=""
            rows={MIN_ROWS}
            style={{
              width: `${widthPx}px`,
              minWidth: `${MIN_TOTAL_WIDTH_PX}px`,
              minHeight: `${MIN_ROWS * LINE_HEIGHT_APPROX}px`,
              resize: "none",
              overflow: "hidden",
            }}
          />
        ) : (
          <div
            role="button"
            tabIndex={0}
            className="rounded-md px-3 py-2 text-sm text-foreground whitespace-pre-wrap break-words empty:min-h-[1.5rem] empty:min-w-[1ch]"
            style={{
              minWidth: `${MIN_TOTAL_WIDTH_PX}px`,
              minHeight: `${readOnlyMinHeight}px`,
            }}
            onDoubleClick={handleDoubleClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleDoubleClick();
              }
            }}
          >
            {value || "\u00A0"}
          </div>
        )}
      </div>
    </div>
  );
}

export const TextBoxNode = memo(TextBoxNodeBase);
