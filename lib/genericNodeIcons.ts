import type { LucideIcon } from "lucide-react";
import { Database, Box, Zap, Globe, MessageSquare } from "lucide-react";

/** Generic (brandless) node types that use Lucide icons instead of AWS assets. */
const GENERIC_TYPE_TO_ICON: Record<string, LucideIcon> = {
  genericNosql: Database,
  genericCache: Box,
  genericRelational: Database,
  genericServerless: Zap,
  genericApi: Globe,
  genericQueue: MessageSquare,
};

export function getGenericIcon(type: string): LucideIcon | null {
  return GENERIC_TYPE_TO_ICON[type] ?? null;
}

export function isGenericNodeType(type: string): boolean {
  return type in GENERIC_TYPE_TO_ICON;
}
