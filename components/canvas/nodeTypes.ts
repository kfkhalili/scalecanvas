import type { NodeTypes } from "reactflow";
import { AwsNode } from "./nodes/AwsNode";
import { SERVICE_CATALOG } from "@/lib/serviceCatalog";

export const awsNodeTypes: NodeTypes = Object.fromEntries([
  ["default", AwsNode],
  ...SERVICE_CATALOG.map((s) => [s.type, AwsNode]),
]);
