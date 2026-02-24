"use client";

import { memo } from "react";
import Image from "next/image";
import { Handle, type NodeProps, Position } from "reactflow";
import type { NodeData } from "@/lib/types";
import type { ServiceCategory } from "@/lib/serviceCatalog";
import { getAwsIconUrl } from "@/lib/awsNodeIcons";
import { getGcpIconUrl } from "@/lib/gcpNodeIcons";
import { getGenericIcon } from "@/lib/genericNodeIcons";

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
  notes:       { border: "border-amber-500",  bg: "bg-amber-950" },
  default:     { border: "border-gray-500",   bg: "bg-gray-900" },
};

const TYPE_TO_CATEGORY: Record<string, ServiceCategory> = {
  awsEc2: "compute",
  awsLambda: "compute",
  awsFargate: "containers",
  awsEcs: "containers",
  awsS3: "storage",
  awsEbs: "storage",
  awsDynamodb: "database",
  awsRds: "database",
  awsElasticache: "database",
  awsRedis: "database",
  awsAurora: "database",
  awsApiGateway: "networking",
  awsElb: "networking",
  awsCloudfront: "networking",
  awsRoute53: "networking",
  awsVpc: "networking",
  awsSqs: "integration",
  awsSns: "integration",
  awsEventbridge: "integration",
  awsStepfunctions: "integration",
  awsIam: "security",
  awsCognito: "security",
  awsWaf: "security",
  awsKinesis: "analytics",
  awsRedshift: "analytics",
  genericNosql: "database",
  genericCache: "database",
  genericRelational: "database",
  genericServerless: "compute",
  genericApi: "networking",
  genericQueue: "integration",
  gcpCloudRun: "compute",
  gcpCloudFunctions: "compute",
  gcpComputeEngine: "compute",
  gcpGke: "containers",
  gcpCloudStorage: "storage",
  gcpCloudSql: "database",
  gcpCloudSpanner: "database",
  gcpAlloyDb: "database",
  gcpBigQuery: "database",
  gcpApigee: "networking",
  gcpLoadBalancing: "networking",
  gcpPubSub: "integration",
  gcpVertexAi: "analytics",
};

function AwsNodeBase({ data, type }: AwsNodeProps): React.ReactElement {
  const category: ServiceCategory | "default" =
    (type && TYPE_TO_CATEGORY[type]) || "default";
  const colors = CATEGORY_COLORS[category];
  const label =
    data && "label" in data && typeof data.label === "string"
      ? data.label
      : type ?? "Node";
  const iconUrl = type ? (getAwsIconUrl(type) ?? getGcpIconUrl(type)) : null;
  const GenericIcon = type ? getGenericIcon(type) : null;

  const handleClass = "!bg-gray-500";
  return (
    <div
      className={`flex items-center gap-2 rounded border-2 ${colors.border} ${colors.bg} pl-2 pr-3 py-1.5 text-sm text-white shadow min-w-[100px]`}
    >
      <Handle type="target" position={Position.Top} id="top" className={handleClass} />
      <Handle type="source" position={Position.Top} id="top-out" className={handleClass} />
      <Handle type="target" position={Position.Left} id="left" className={handleClass} />
      <Handle type="source" position={Position.Left} id="left-out" className={handleClass} />
      {iconUrl ? (
        <Image
          src={iconUrl}
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 object-contain"
          unoptimized
        />
      ) : GenericIcon ? (
        <GenericIcon className="h-7 w-7 shrink-0 text-white/90" aria-hidden />
      ) : null}
      <div className="min-w-0 flex-1 font-medium break-words text-left">{label}</div>
      <Handle type="target" position={Position.Right} id="right" className={handleClass} />
      <Handle type="source" position={Position.Right} id="right-out" className={handleClass} />
      <Handle type="target" position={Position.Bottom} id="bottom" className={handleClass} />
      <Handle type="source" position={Position.Bottom} id="bottom-out" className={handleClass} />
    </div>
  );
}

export const AwsNode = memo(AwsNodeBase);
