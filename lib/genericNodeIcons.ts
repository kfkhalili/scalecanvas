import { Option } from "effect";
import type { LucideIcon } from "lucide-react";
import { Database, Box, Zap, Globe, MessageSquare, Laptop } from "lucide-react";

/** Generic (brandless) node types that use Lucide icons instead of AWS assets. */
const GENERIC_TYPE_TO_ICON: Record<string, LucideIcon> = {
  genericClient: Laptop,
  genericNosql: Database,
  genericCache: Box,
  genericRelational: Database,
  genericServerless: Zap,
  genericApi: Globe,
  genericQueue: MessageSquare,
};

export function getGenericIcon(type: string): Option.Option<LucideIcon> {
  const icon = GENERIC_TYPE_TO_ICON[type];
  return icon !== undefined ? Option.some(icon) : Option.none();
}

export function isGenericNodeType(type: string): boolean {
  return type in GENERIC_TYPE_TO_ICON;
}
