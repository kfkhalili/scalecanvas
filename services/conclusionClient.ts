import { Effect } from "effect";
import type { ConclusionBody } from "@/lib/api.schemas";
import { readConclusionStream } from "@/lib/conclusionStream";

export type ConclusionError = { status: number; error: string };

/**
 * POST to conclusion endpoint and consume stream. Returns full assistant text or error.
 * On 403, returns left with error message (time not expired or already generated).
 */

export function requestConclusion(
  sessionId: string,
  body: ConclusionBody
): Effect.Effect<string, ConclusionError> {
  return Effect.gen(function* () {
    const res = yield* Effect.tryPromise({
      try: () =>
        fetch(`/api/sessions/${sessionId}/conclusion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        }),
      catch: (e): ConclusionError =>
        ({ status: 0, error: e instanceof Error ? e.message : "Network error" }),
    });
    if (res.status === 403) {
      const data = (yield* Effect.tryPromise({
        try: () => res.json() as Promise<{ error?: string }>,
        catch: (): ConclusionError => ({ status: 403, error: "Request failed" }),
      })) as { error?: string };
      return yield* Effect.fail({ status: 403, error: data.error ?? "Request failed" });
    }
    if (!res.ok) {
      const data = (yield* Effect.tryPromise({
        try: () => res.json().catch(() => ({})) as Promise<{ error?: string }>,
        catch: (): ConclusionError => ({ status: res.status, error: res.statusText ?? "Request failed" }),
      })) as { error?: string };
      return yield* Effect.fail({ status: res.status, error: data?.error ?? res.statusText ?? "Request failed" });
    }
    const stream = res.body;
    if (!stream) return yield* Effect.fail({ status: 502, error: "No response body" });
    const text = yield* Effect.tryPromise({
      try: () => readConclusionStream(stream),
      catch: (e): ConclusionError =>
        ({ status: 502, error: e instanceof Error ? e.message : "Stream error" }),
    });
    return text;
  });
}
