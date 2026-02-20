"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "reactflow";
import type { NodeData } from "@/lib/types";
import type { ServiceCategory } from "@/lib/serviceCatalog";

type OurNode = { id: string; type?: string; data: NodeData };
type AwsNodeProps = NodeProps<OurNode>;

const CATEGORY_COLORS: Record<ServiceCategory | "default", { border: string; bg: string }> = {
  compute:     { border: "border-orange-500", bg: "bg-orange-950" },
  networking:  { border: "border-blue-500",   bg: "bg-blue-950" },
  storage:     { border: "border-green-500",  bg: "bg-green-950" },
  database:    { border: "border-purple-500", bg: "bg-purple-950" },
  containers:  { border: "border-cyan-500",   bg: "bg-cyan-950" },
  integration: { border: "border-pink-500",   bg: "bg-pink-950" },
  security:    { border: "border-red-500",    bg: "bg-red-950" },
  analytics:   { border: "border-amber-500",  bg: "bg-amber-950" },
  default:     { border: "border-gray-500",   bg: "bg-gray-900" },
};

const TYPE_TO_CATEGORY: Record<string, ServiceCategory> = {
  ec2: "compute",
  lambda: "compute",
  fargate: "containers",
  ecs: "containers",
  s3: "storage",
  ebs: "storage",
  dynamodb: "database",
  rds: "database",
  elasticache: "database",
  aurora: "database",
  apiGateway: "networking",
  elb: "networking",
  cloudfront: "networking",
  route53: "networking",
  vpc: "networking",
  sqs: "integration",
  sns: "integration",
  eventbridge: "integration",
  stepfunctions: "integration",
  iam: "security",
  cognito: "security",
  waf: "security",
  kinesis: "analytics",
  redshift: "analytics",
};

function AwsNodeBase({ data, type }: AwsNodeProps): React.ReactElement {
  const category: ServiceCategory | "default" =
    (type && TYPE_TO_CATEGORY[type]) || "default";
  const colors = CATEGORY_COLORS[category];
  const label =
    data && "label" in data && typeof data.label === "string"
      ? data.label
      : type ?? "Node";

  return (
    <div className={`rounded border-2 ${colors.border} ${colors.bg} px-3 py-2 text-sm text-white shadow min-w-[100px] text-center`}>
      <Handle type="target" position={Position.Top} className="!bg-gray-500" />
      <div className="font-medium">{label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500" />
    </div>
  );
}

export const AwsNode = memo(AwsNodeBase);
