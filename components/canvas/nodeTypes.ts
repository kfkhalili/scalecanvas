import type { NodeTypes } from "reactflow";
import { AwsNode } from "./nodes/AwsNode";

export const awsNodeTypes: NodeTypes = {
  default: AwsNode,
  s3: AwsNode,
  lambda: AwsNode,
  apiGateway: AwsNode,
};
