import { Option } from "effect";
import type { LucideIcon } from "lucide-react";
import { getAwsIconUrl } from "@/lib/awsNodeIcons";
import { getAzureIconUrl } from "@/lib/azureNodeIcons";
import { getGcpIconUrl } from "@/lib/gcpNodeIcons";
import { getGenericIcon } from "@/lib/genericNodeIcons";

/**
 * Resolve icon URL by provider prefix (one getter per type). Use for node library and canvas nodes.
 */
export function getNodeIconUrl(type: string): Option.Option<string> {
  if (type.startsWith("aws")) return getAwsIconUrl(type);
  if (type.startsWith("gcp")) return getGcpIconUrl(type);
  if (type.startsWith("azure")) return getAzureIconUrl(type);
  if (type.startsWith("generic")) return Option.none();
  return Option.none();
}

/**
 * Resolve Lucide component for types that use generic (brandless) icons. Use when getNodeIconUrl returns none.
 */
export function getNodeIconComponent(type: string): Option.Option<LucideIcon> {
  if (type.startsWith("generic")) return getGenericIcon(type);
  return Option.none();
}
