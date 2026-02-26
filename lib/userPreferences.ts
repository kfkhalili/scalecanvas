import { Effect, Option, pipe } from "effect";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { NodeLibraryProviderSchema } from "@/lib/api.schemas";
import {
  NODE_LIBRARY_PROVIDER_KEY,
  type NodeLibraryProvider,
} from "@/lib/types";

/** Parses stored value: "" or "all" (after trim) → []; else split by comma, trim, parse, dedupe. */
export function parseProvidersValue(value: string): NodeLibraryProvider[] {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "all") return [];
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  const parsed: NodeLibraryProvider[] = [];
  const seen = new Set<NodeLibraryProvider>();
  for (const part of parts) {
    const result = NodeLibraryProviderSchema.safeParse(part);
    if (result.success && !seen.has(result.data)) {
      seen.add(result.data);
      parsed.push(result.data);
    }
  }
  return parsed;
}

/** Serializes provider set to stored string. Empty array → "". */
export function serializeProviders(
  providers: readonly NodeLibraryProvider[]
): string {
  return providers.length === 0 ? "" : providers.join(",");
}

export function getNodeLibraryProviders(
  client: ServerSupabaseClient,
  userId: string
): Effect.Effect<Option.Option<NodeLibraryProvider[]>> {
  return pipe(
    Effect.tryPromise({
      try: () =>
        client
          .from("user_preferences")
          .select("value")
          .eq("user_id", userId)
          .eq("key", NODE_LIBRARY_PROVIDER_KEY)
          .maybeSingle(),
      catch: () => new Error("user_preferences fetch failed"),
    }),
    Effect.map(({ data, error }) => {
      if (error) return Option.none();
      if (data === null) return Option.none();
      const raw =
        typeof data === "object" && data !== null && "value" in data
          ? (data as { value: string }).value
          : "";
      const value = typeof raw === "string" ? raw : "";
      return Option.some(parseProvidersValue(value));
    }),
    Effect.catchAll(() => Effect.succeed(Option.none()))
  );
}

export function setNodeLibraryProviders(
  client: ServerSupabaseClient,
  userId: string,
  providers: NodeLibraryProvider[]
): Effect.Effect<void, Error> {
  const row = {
    user_id: userId,
    key: NODE_LIBRARY_PROVIDER_KEY,
    value: serializeProviders(providers),
    updated_at: new Date().toISOString(),
  };
  return pipe(
    Effect.promise(() =>
      client
        .from("user_preferences")
        .upsert(row as never, { onConflict: "user_id,key" })
    ),
    Effect.flatMap(({ error }) =>
      error
        ? Effect.fail(new Error(error.message))
        : Effect.succeed(undefined)
    )
  );
}
