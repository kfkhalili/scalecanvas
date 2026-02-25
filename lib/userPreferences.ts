import { Effect, Option, pipe } from "effect";
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

function parseProviderOption(value: string): Option.Option<NodeLibraryProvider> {
  return VALID_PROVIDERS.includes(value as NodeLibraryProvider)
    ? Option.some(value as NodeLibraryProvider)
    : Option.none();
}

export function getNodeLibraryProvider(
  client: ServerSupabaseClient,
  userId: string
): Effect.Effect<Option.Option<NodeLibraryProvider>> {
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
      const row = data as { value: string } | null;
      return pipe(
        Option.fromNullable(row?.value ?? null),
        Option.flatMap(parseProviderOption)
      );
    }),
    Effect.catchAll(() => Effect.succeed(Option.none()))
  );
}

export function setNodeLibraryProvider(
  client: ServerSupabaseClient,
  userId: string,
  value: NodeLibraryProvider
): Effect.Effect<void, Error> {
  const row = {
    user_id: userId,
    key: NODE_LIBRARY_PROVIDER_KEY,
    value,
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
