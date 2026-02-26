import { Box } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NodeLibraryProvider } from "@/lib/types";

export type ProviderIconResult =
  | { type: "image"; src: string }
  | { type: "lucide"; Icon: LucideIcon };

/**
 * Resolve icon for the node library provider filter bar.
 * AWS, GCP, Azure use image assets; generic uses a Lucide icon.
 */
export function getProviderIcon(
  provider: NodeLibraryProvider
): ProviderIconResult {
  switch (provider) {
    case "aws":
      return { type: "image", src: "/icons/providers/aws.svg" };
    case "gcp":
      return { type: "image", src: "/icons/providers/gcp.svg" };
    case "azure":
      return { type: "image", src: "/icons/providers/azure.svg" };
    case "generic":
      return { type: "lucide", Icon: Box };
  }
}
