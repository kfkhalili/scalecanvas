import { Effect, pipe } from "effect";

export type CheckoutError = { message: string };

export function fetchTokenBalance(): Effect.Effect<number, CheckoutError> {
  return pipe(
    Effect.tryPromise({
      try: () => fetch("/api/tokens/balance"),
      catch: (e) => ({ message: e instanceof Error ? e.message : "Network error" }),
    }),
    Effect.flatMap((res) =>
      res.ok
        ? Effect.tryPromise({
            try: () => res.json() as Promise<{ tokens: number }>,
            catch: (e) => ({ message: e instanceof Error ? e.message : "Network error" }),
          }).pipe(Effect.map((json) => json.tokens))
        : Effect.tryPromise({
            try: () => res.json().catch(() => ({})) as Promise<{ error?: string }>,
            catch: () => ({ message: "Failed to fetch token balance" }),
          }).pipe(
            Effect.flatMap((data) =>
              Effect.fail({ message: data.error ?? "Failed to fetch token balance" })
            )
          )
    )
  );
}

export function initiateCheckout(
  packId: string
): Effect.Effect<string, CheckoutError> {
  return pipe(
    Effect.tryPromise({
      try: () =>
        fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pack_id: packId }),
        }),
      catch: (e) => ({ message: e instanceof Error ? e.message : "Network error" }),
    }),
    Effect.flatMap((res) =>
      res.ok
        ? Effect.tryPromise({
            try: () => res.json() as Promise<{ url: string }>,
            catch: (e) => ({ message: e instanceof Error ? e.message : "Network error" }),
          }).pipe(Effect.map((json) => json.url))
        : Effect.tryPromise({
            try: () => res.json().catch(() => ({})) as Promise<{ error?: string }>,
            catch: () => ({ message: "Failed to create checkout session" }),
          }).pipe(
            Effect.flatMap((data) =>
              Effect.fail({
                message: data.error ?? "Failed to create checkout session",
              })
            )
          )
    )
  );
}
