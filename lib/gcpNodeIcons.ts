import { Option } from "effect";

/**
 * GCP node types (service catalog) to gcp-icons package icon keys (kebab-case).
 * Icons are loaded from unpkg CDN (gcp-icons@1.0.4), same pattern as aws-icons.
 * @see https://www.npmjs.com/package/gcp-icons
 */
const GCP_ICONS_BASE = "https://unpkg.com/gcp-icons@1.0.4/dist";

const GCP_TYPE_TO_ICON_KEY: Record<string, string> = {
  gcpCloudRun: "cloudrun-512-color-rgb",
  gcpGke: "gke-512-color",
  gcpComputeEngine: "computeengine-512-color-rgb",
  gcpCloudFunctions: "serverlesscomputing-512-color",
  gcpCloudStorage: "cloud-storage-512-color",
  gcpCloudSql: "cloudsql-512-color",
  gcpCloudSpanner: "cloudspanner-512-color",
  gcpAlloyDb: "alloydb-512-color",
  gcpBigQuery: "bigquery-512-color",
  gcpApigee: "apigee-512-color-rgb",
  gcpLoadBalancing: "networking-512-color-rgb",
  gcpPubSub: "integrationservices-512-color",
  gcpVertexAi: "vertexai-512-color",
};

export function getGcpIconUrl(type: string): Option.Option<string> {
  const iconKey = GCP_TYPE_TO_ICON_KEY[type];
  if (!iconKey) return Option.none();
  return Option.some(`${GCP_ICONS_BASE}/icons/${iconKey}.svg`);
}

export function isGcpNodeType(type: string): boolean {
  return type in GCP_TYPE_TO_ICON_KEY;
}
