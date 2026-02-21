"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClientInstance } from "@/lib/supabase/client";
import { rehydrateCanvasStore, useCanvasStore } from "@/stores/canvasStore";
import { useAuthHandoffStore, rehydrateAuthHandoffStore } from "@/stores/authHandoffStore";
import { deductTokenAndCreateSession } from "@/services/tokensClient";
import { createSessionApi, renameSessionApi } from "@/services/sessionsClient";
import { InterviewSplitView } from "@/components/interview/InterviewSplitView";

/**
 * Renders the workspace at / when the user is logged in. After rehydrating
 * persisted stores it decides how to bootstrap the session:
 *
 *  1. Anonymous chat exists + Evaluate clicked  → deduct token, rename session, handoff
 *  2. Anonymous chat exists + no Evaluate       → create session with title, handoff
 *  3. No anonymous chat (fresh /login visit)    → create session, redirect to /:id
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
    const hasAttemptedEval = useCanvasStore.getState().hasAttemptedEval;
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
        createSessionApi().then((r) =>
          r.match(
            (s) => router.replace(`/${s.id}`),
            () => router.replace("/login")
          )
        );
        return;
      }

      if (hasAttemptedEval) {
        setHasAttemptedEval(false);
        deductTokenAndCreateSession(supabase).then((result) =>
          result.match(
            (sessionId) => {
              if (questionTitle) renameSessionApi(sessionId, questionTitle);
              setPendingAuthHandoff(sessionId);
            },
            () => router.replace("/login")
          )
        );
      } else {
        createSessionApi(questionTitle).then((r) =>
          r.match(
            (s) => setPendingAuthHandoff(s.id),
            () => router.replace("/login")
          )
        );
      }
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
      <div className="min-h-0 flex-1">
        <InterviewSplitView isAnonymous={false} />
      </div>
    </main>
  );
}
