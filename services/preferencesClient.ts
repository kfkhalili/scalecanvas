import { Effect, Option, pipe } from "effect";
import { NodeLibraryProviderSchema } from "@/lib/api.schemas";
import { apiGet, apiPatch } from "@/services/sessionsClient";
import type { ApiError } from "@/services/sessionsClient";
import type { NodeLibraryProvider } from "@/lib/types";

/**
 * Fetch the signed-in user's preferred node-library cloud provider.
 * Returns `Option.none()` when no preference is stored.
 */
export function fetchNodeLibraryProvider(): Effect.Effect<
  Option.Option<NodeLibraryProvider>,
  ApiError
> {
  return pipe(
    apiGet<{ provider?: string | null }>("/api/preferences"),
    Effect.map((data) => {
      const result = NodeLibraryProviderSchema.safeParse(data.provider);
      return result.success ? Option.some(result.data) : Option.none();
    })
  );
}

/**
 * Persist the user's preferred cloud provider filter.
 */
export function saveNodeLibraryProvider(
  provider: NodeLibraryProvider
): Effect.Effect<{ ok: boolean }, ApiError> {
  return apiPatch<{ ok: boolean }>("/api/preferences", { provider });
}
