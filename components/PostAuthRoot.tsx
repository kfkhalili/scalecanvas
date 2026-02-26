"use client";

import { Effect, Either, Option } from "effect";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClientInstance } from "@/lib/supabase/client";
import { rehydrateCanvasStore, useCanvasStore } from "@/stores/canvasStore";
import { useAuthHandoffStore, rehydrateAuthHandoffStore } from "@/stores/authHandoffStore";
import { postHandoff } from "@/services/handoffClient";
import { fetchSessions } from "@/services/sessionsClient";
import { whenRight } from "@/lib/optionHelpers";
import { InterviewSplitView } from "@/components/interview/InterviewSplitView";
import { CheckoutFeedback } from "@/components/billing/CheckoutFeedback";

/**
 * Renders the workspace at / when the user is logged in. After rehydrating
 * persisted stores it decides how to bootstrap the session:
 *
 *  1. Anonymous chat exists → POST /api/auth/handoff: if eligible (trial not claimed), creates trial session and handoff; else created: false, clear state and resume
 *  2. No anonymous chat (fresh /login visit) → redirect to most recent session, or show empty workspace
 */
export function PostAuthRoot(): React.ReactElement {
  const router = useRouter();
  const [storesReady, setStoresReady] = useState(false);

  useEffect(() => {
    Promise.all([
      rehydrateCanvasStore() ?? Promise.resolve(),
      rehydrateAuthHandoffStore() ?? Promise.resolve(),
    ]).then(() => setStoresReady(true));
  }, []);

  useEffect(() => {
    if (!storesReady) return;

    const supabase = createBrowserClientInstance();
    const setHasAttemptedEval = useCanvasStore.getState().setHasAttemptedEval;
    const setPendingAuthHandoff = useAuthHandoffStore.getState().setPendingAuthHandoff;
    const hasAnonymousChat = useAuthHandoffStore.getState().anonymousMessages.length > 0;
    const questionTitle = useAuthHandoffStore.getState().questionTitle;

    supabase.auth.getUser().then((res) => {
      const user = res.data.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      if (!hasAnonymousChat) {
        void Effect.runPromise(Effect.either(fetchSessions())).then((either) =>
          whenRight(either, (list) => {
            if (list.length > 0) router.replace(`/${list[0].id}`);
          })
        );
        return;
      }

      setHasAttemptedEval(false);
      void Effect.runPromise(
        Effect.either(postHandoff(questionTitle))
      ).then((handoffEither) =>
        Either.match(handoffEither, {
          onLeft: () => {
            useAuthHandoffStore.getState().setAnonymousMessages([]);
            useAuthHandoffStore.getState().setQuestionTitle(Option.none());
            void Effect.runPromise(Effect.either(fetchSessions())).then(
              (either) =>
                whenRight(either, (list) => {
                  if (list.length > 0) router.replace(`/${list[0].id}`);
                })
            );
          },
          onRight: (payload) => {
            if (payload.created && payload.session_id) {
              setPendingAuthHandoff(Option.some(payload.session_id));
              router.replace(`/${payload.session_id}`);
            } else {
              useAuthHandoffStore.getState().setAnonymousMessages([]);
              useAuthHandoffStore.getState().setQuestionTitle(Option.none());
              void Effect.runPromise(Effect.either(fetchSessions())).then(
                (either) =>
                  whenRight(either, (list) => {
                    if (list.length > 0) router.replace(`/${list[0].id}`);
                  })
              );
            }
          },
        })
      );
    });
  }, [storesReady, router]);

  if (!storesReady) {
    return (
      <main className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading session…</div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col">
      <CheckoutFeedback />
      <div className="min-h-0 flex-1">
        <InterviewSplitView isAnonymous={false} />
      </div>
    </main>
  );
}
