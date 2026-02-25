import { Option } from "effect";

/**
 * Maps GCP catalog node types to SVG filenames in public/icons/gcp/ (2025 set).
 * Icons are from https://cloud.google.com/icons (Core product + Category icons).
 */
const GCP_TYPE_TO_FILENAME: Record<string, string> = {
  gcpCloudRun: "CloudRun-512-color-rgb.svg",
  gcpGke: "GKE-512-color.svg",
  gcpComputeEngine: "ComputeEngine-512-color-rgb.svg",
  gcpCloudFunctions: "ServerlessComputing-512-color.svg",
  gcpCloudStorage: "Cloud_Storage-512-color.svg",
  gcpCloudSql: "CloudSQL-512-color.svg",
  gcpCloudSpanner: "CloudSpanner-512-color.svg",
  gcpAlloyDb: "AlloyDB-512-color.svg",
  gcpBigQuery: "BigQuery-512-color.svg",
  gcpApigee: "Apigee-512-color-rgb.svg",
  gcpLoadBalancing: "Networking-512-color-rgb.svg",
  gcpPubSub: "IntegrationServices-512-color.svg",
  gcpVertexAi: "VertexAI-512-color.svg",
};

export function getGcpIconUrl(type: string): Option.Option<string> {
  const filename = GCP_TYPE_TO_FILENAME[type];
  if (!filename) return Option.none();
  return Option.some(`/icons/gcp/${filename}`);
}

export function isGcpNodeType(type: string): boolean {
  return type in GCP_TYPE_TO_FILENAME;
}
