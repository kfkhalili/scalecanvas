import { ok, err, type Result } from "neverthrow";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import {
  NODE_LIBRARY_PROVIDER_KEY,
  type NodeLibraryProvider,
} from "@/lib/types";

const VALID_PROVIDERS: readonly NodeLibraryProvider[] = [
  "all",
  "aws",
  "gcp",
  "azure",
  "generic",
];

function parseProvider(value: string | null): NodeLibraryProvider | null {
  if (value === null || value === undefined) return null;
  return VALID_PROVIDERS.includes(value as NodeLibraryProvider)
    ? (value as NodeLibraryProvider)
    : null;
}

export async function getNodeLibraryProvider(
  client: ServerSupabaseClient,
  userId: string
): Promise<NodeLibraryProvider | null> {
  const { data, error } = await client
    .from("user_preferences")
    .select("value")
    .eq("user_id", userId)
    .eq("key", NODE_LIBRARY_PROVIDER_KEY)
    .maybeSingle();

  if (error) return null;
  const row = data as { value: string } | null;
  return parseProvider(row?.value ?? null);
}

export async function setNodeLibraryProvider(
  client: ServerSupabaseClient,
  userId: string,
  value: NodeLibraryProvider
): Promise<Result<void, Error>> {
  const row = {
    user_id: userId,
    key: NODE_LIBRARY_PROVIDER_KEY,
    value,
    updated_at: new Date().toISOString(),
  };
  const { error } = await client
    .from("user_preferences")
    .upsert(row as never, { onConflict: "user_id,key" });

  if (error) return err(error);
  return ok(undefined);
}
