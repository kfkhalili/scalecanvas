"use client";

import { Effect, Either, Option } from "effect";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClientInstance } from "@/lib/supabase/client";
import { useCanvasStore } from "@/stores/canvasStore";
import { useAuthHandoffStore } from "@/stores/authHandoffStore";
import { loadAnonymousWorkspace } from "@/stores/anonymousWorkspaceStorage";
import { postHandoff } from "@/services/handoffClient";
import { fetchSessions } from "@/services/sessionsClient";
import { whenRight } from "@/lib/optionHelpers";
import { InterviewSplitView } from "@/components/interview/InterviewSplitView";

/**
 * Renders the workspace at / when the user is logged in. After rehydrating
 * persisted stores it decides how to bootstrap the session:
 *
 *  1. Anonymous chat exists → POST /api/auth/handoff: if eligible (trial not claimed), creates trial session and handoff; else created: false, clear state and resume
 *  2. No anonymous chat (fresh visit) → redirect to most recent session, or show empty workspace
 */
export function PostAuthRoot(): React.ReactElement {
  const router = useRouter();
  const [storesReady, setStoresReady] = useState(false);

  useEffect(() => {
    loadAnonymousWorkspace();
    queueMicrotask(() => setStoresReady(true));
  }, []);

  useEffect(() => {
    if (!storesReady) return;

    const supabase = createBrowserClientInstance();
    const setHasAttemptedEval = useCanvasStore.getState().setHasAttemptedEval;
    const setPendingAuthHandoff = useAuthHandoffStore.getState().setPendingAuthHandoff;
    const hasAnonymousChat = useAuthHandoffStore.getState().anonymousMessages.length > 0;
    const questionTitle = useAuthHandoffStore.getState().questionTitle;

    const debug = typeof window !== "undefined" && (window as Window & { __E2E_DEBUG__?: boolean }).__E2E_DEBUG__;
    if (debug) {
      console.log("[PostAuthRoot] storesReady=true", { hasAnonymousChat, questionTitle: Option.getOrNull(questionTitle) });
    }

    supabase.auth.getUser().then((res) => {
      const user = res.data.user;
      if (debug) {
        console.log("[PostAuthRoot] getUser", user ? { id: user.id } : "no user");
      }
      if (!user) {
        router.replace("/");
        return;
      }

      if (!hasAnonymousChat) {
        if (debug) console.log("[PostAuthRoot] no anonymous chat, fetching sessions");
        void Effect.runPromise(Effect.either(fetchSessions())).then((either) =>
          whenRight(either, (list) => {
            if (debug) console.log("[PostAuthRoot] fetchSessions", list.length, list[0]?.id);
            if (list.length > 0) router.replace(`/${list[0].id}`);
          })
        );
        return;
      }

      setHasAttemptedEval(false);
      void Effect.runPromise(
        Effect.either(postHandoff(questionTitle))
      ).then((handoffEither) => {
        if (debug) {
          Either.match(handoffEither, {
            onLeft: (e) => console.log("[PostAuthRoot] handoff failed", e),
            onRight: (p) => console.log("[PostAuthRoot] handoff result", p),
          });
        }
        return Either.match(handoffEither, {
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
        });
      });
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
