import { Effect, pipe } from "effect";
import type { HandoffResponse } from "@/lib/api.schemas";

export type HandoffError = { message: string };

export function postHandoff(
  questionTitle?: string | null
): Effect.Effect<HandoffResponse, HandoffError> {
  return pipe(
    Effect.tryPromise({
      try: () =>
        fetch("/api/auth/handoff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ question_title: questionTitle ?? null }),
        }),
      catch: (e) => ({
        message: e instanceof Error ? e.message : "Network error",
      }),
    }),
    Effect.flatMap((res) => {
      if (res.status === 401 || res.status >= 500) {
        return Effect.tryPromise({
          try: () =>
            res.json().catch(() => ({})) as Promise<{ error?: string }>,
          catch: () => ({ message: "Handoff failed" }),
        }).pipe(
          Effect.flatMap((data) =>
            Effect.fail({ message: data.error ?? "Handoff failed" })
          )
        );
      }
      return Effect.tryPromise({
        try: () =>
          res.json() as Promise<{
            created: boolean;
            session_id?: string;
          }>,
        catch: (e) => ({
          message: e instanceof Error ? e.message : "Parse error",
        }),
      }).pipe(
        Effect.map((json) => {
          if (res.status === 201 && json.created === true && typeof json.session_id === "string") {
            return { created: true as const, session_id: json.session_id };
          }
          return { created: false as const };
        })
      );
    })
  );
}
