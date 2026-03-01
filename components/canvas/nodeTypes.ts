import type { NodeTypes } from "@xyflow/react";
import { AwsNode } from "./nodes/AwsNode";
import { TextBoxNode } from "./nodes/TextBoxNode";
import { SERVICE_CATALOG } from "@/lib/serviceCatalog";

export const awsNodeTypes: NodeTypes = Object.fromEntries([
  ["default", AwsNode],
  ["text", TextBoxNode],
  ...SERVICE_CATALOG.filter((s) => s.type !== "text").map((s) => [s.type, AwsNode]),
]);
