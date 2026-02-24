import type { LucideIcon } from "lucide-react";
import { getAwsIconUrl } from "@/lib/awsNodeIcons";
import { getAzureIconUrl } from "@/lib/azureNodeIcons";
import { getGcpIconUrl } from "@/lib/gcpNodeIcons";
import { getGenericIcon } from "@/lib/genericNodeIcons";

/**
 * Resolve icon URL by provider prefix (one getter per type). Use for node library and canvas nodes.
 */
export function getNodeIconUrl(type: string): string | null {
  if (type.startsWith("aws")) return getAwsIconUrl(type);
  if (type.startsWith("gcp")) return getGcpIconUrl(type);
  if (type.startsWith("azure")) return getAzureIconUrl(type);
  if (type.startsWith("generic")) return null;
  return null;
}

/**
 * Resolve Lucide component for types that use generic (brandless) icons. Use when getNodeIconUrl returns null.
 */
export function getNodeIconComponent(type: string): LucideIcon | null {
  if (type.startsWith("generic")) return getGenericIcon(type);
  return null;
}
