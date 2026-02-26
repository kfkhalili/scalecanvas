import { Effect, Option, pipe } from "effect";
import { NodeLibraryProvidersSchema } from "@/lib/api.schemas";
import { apiGet, apiPatch } from "@/services/sessionsClient";
import type { ApiError } from "@/services/sessionsClient";
import type { NodeLibraryProvider } from "@/lib/types";

/**
 * Fetch the signed-in user's preferred node-library cloud providers.
 * Returns Option.some([]) when missing or invalid (empty = no filter per design).
 */
export function fetchNodeLibraryProviders(): Effect.Effect<
  Option.Option<NodeLibraryProvider[]>,
  ApiError
> {
  return pipe(
    apiGet<{ providers?: string[] }>("/api/preferences"),
    Effect.map((data) => {
      const result = NodeLibraryProvidersSchema.safeParse(data.providers);
      return Option.some(result.success ? result.data : []);
    })
  );
}

/**
 * Persist the user's preferred cloud provider filter set.
 */
export function saveNodeLibraryProviders(
  providers: NodeLibraryProvider[]
): Effect.Effect<{ ok: boolean }, ApiError> {
  return apiPatch<{ ok: boolean }>("/api/preferences", { providers });
}
