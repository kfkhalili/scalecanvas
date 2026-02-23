"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClientInstance } from "@/lib/supabase/client";
import { rehydrateCanvasStore, useCanvasStore } from "@/stores/canvasStore";
import { useAuthHandoffStore, rehydrateAuthHandoffStore } from "@/stores/authHandoffStore";
import { postHandoff } from "@/services/handoffClient";
import { renameSessionApi, fetchSessions } from "@/services/sessionsClient";
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
      postHandoff(questionTitle).then((result) =>
        result.match(
          (payload) => {
            if (payload.created && payload.session_id) {
              if (questionTitle) renameSessionApi(payload.session_id, questionTitle);
              setPendingAuthHandoff(payload.session_id);
              router.replace(`/${payload.session_id}`);
            } else {
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
