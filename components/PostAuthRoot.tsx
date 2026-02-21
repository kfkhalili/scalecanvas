"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClientInstance } from "@/lib/supabase/client";
import { rehydrateCanvasStore, useCanvasStore } from "@/stores/canvasStore";
import { useAuthHandoffStore, rehydrateAuthHandoffStore } from "@/stores/authHandoffStore";
import { deductTokenAndCreateSession } from "@/services/tokensClient";
import { renameSessionApi, fetchSessions } from "@/services/sessionsClient";
import { InterviewSplitView } from "@/components/interview/InterviewSplitView";
import { CheckoutFeedback } from "@/components/billing/CheckoutFeedback";

/**
 * Renders the workspace at / when the user is logged in. After rehydrating
 * persisted stores it decides how to bootstrap the session:
 *
 *  1. Anonymous chat exists (eval or not) → deduct token, create session, rename, handoff (one trial = one session)
 *  2. No anonymous chat (fresh /login visit) → redirect to most recent session, or show empty workspace
 *
 * If deduct fails (no tokens), handoff state is cleared and we resume or show empty.
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

    supabase.auth.getSession().then((res) => {
      const session = res.data.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      if (!hasAnonymousChat) {
        fetchSessions().then((r) =>
          r.match(
            (list) => {
              if (list.length > 0) {
                router.replace(`/${list[0].id}`);
              }
            },
            () => {}
          )
        );
        return;
      }

      setHasAttemptedEval(false);
      deductTokenAndCreateSession(supabase).then((result) =>
        result.match(
          (sessionId) => {
            if (questionTitle) renameSessionApi(sessionId, questionTitle);
            setPendingAuthHandoff(sessionId);
          },
          () => {
            useAuthHandoffStore.getState().setAnonymousMessages([]);
            useAuthHandoffStore.getState().setQuestionTitle(null);
            fetchSessions().then((r) =>
              r.match(
                (list) => {
                  if (list.length > 0) router.replace(`/${list[0].id}`);
                },
                () => {}
              )
            );
          }
        )
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
