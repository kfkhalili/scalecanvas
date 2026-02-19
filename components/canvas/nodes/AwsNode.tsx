"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "reactflow";
import type { NodeData } from "@/lib/types";

type OurNode = { id: string; type?: string; data: NodeData };
type AwsNodeProps = NodeProps<OurNode>;

const base =
  "rounded border-2 border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white shadow min-w-[100px] text-center";

const styles: Record<string, string> = {
  s3: "border-orange-500 bg-orange-950",
  lambda: "border-amber-500 bg-amber-950",
  apiGateway: "border-rose-500 bg-rose-950",
  default: "border-gray-500",
};

function AwsNodeBase({ data, type }: AwsNodeProps): React.ReactElement {
  const style = type && styles[type] ? styles[type] : styles.default;
  const label =
    data && "label" in data && typeof data.label === "string"
      ? data.label
      : type ?? "Node";
  return (
    <div className={`${base} ${style}`}>
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      <div className="font-medium">{label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}

export const AwsNode = memo(AwsNodeBase);
