"use client";

import { Effect, Either } from "effect";
import { useEffect } from "react";
import { createBrowserClientInstance } from "@/lib/supabase/client";
import { useCanvasStore } from "@/stores/canvasStore";
import { useAuthHandoffStore } from "@/stores/authHandoffStore";
import { deductTokenAndCreateSession } from "@/services/tokensClient";

type GetSessionResult = { data: { session: unknown } };

/**
 * Pure logic for post-auth handoff: if session exists and hasAttemptedEval,
 * reset flag, call RPC; on success set pending handoff. Used by hook and tests.
 */
export async function runPostAuthHandoff(
  getSessionResult: GetSessionResult,
  hasAttemptedEval: boolean,
  setHasAttemptedEval: (value: boolean) => void,
  deductRpc: () => ReturnType<typeof deductTokenAndCreateSession>,
  setPendingHandoff: (sessionId: string) => void
): Promise<void> {
  const session = getSessionResult?.data?.session;
  if (!session || !hasAttemptedEval) return;
  setHasAttemptedEval(false);
  const either = await Effect.runPromise(Effect.either(deductRpc()));
  Either.match(either, {
    onLeft: () => {},
    onRight: (sessionId) => setPendingHandoff(sessionId),
  });
}

/**
 * Client-side effect: when there is a Supabase session and the store has
 * hasAttemptedEval true (e.g. after OAuth return), reset it and run the
 * token-deduct RPC; on success set pendingAuthHandoff so ChatPanel can run BFF handoff.
 */
export function usePostAuthHandoff(): void {
  const hasAttemptedEval = useCanvasStore((s) => s.hasAttemptedEval);
  const setHasAttemptedEval = useCanvasStore((s) => s.setHasAttemptedEval);
  const setPendingAuthHandoff = useAuthHandoffStore((s) => s.setPendingAuthHandoff);

  useEffect(() => {
    const supabase = createBrowserClientInstance();
    supabase.auth.getSession().then((getSessionResult) => {
      runPostAuthHandoff(
        getSessionResult as GetSessionResult,
        hasAttemptedEval,
        setHasAttemptedEval,
        () => deductTokenAndCreateSession(supabase),
        setPendingAuthHandoff
      );
    });
  }, [hasAttemptedEval, setHasAttemptedEval, setPendingAuthHandoff]);
}
