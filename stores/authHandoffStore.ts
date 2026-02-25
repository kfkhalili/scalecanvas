import { Option } from "effect";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TranscriptEntry } from "@/lib/types";

/** Message shape for anonymous chat backup (survives OAuth redirect). */
export type AnonymousMessage = { id: string; role: string; content: string };

type HandoffTranscript = { sessionId: string; entries: TranscriptEntry[] };

type AuthHandoffStore = {
  /** When set, ChatPanel should run BFF handoff then clear and navigate to this session. */
  pendingSessionId: Option.Option<string>;
  setPendingAuthHandoff: (sessionId: Option.Option<string>) => void;
  /** Transcript carried across handoff so the session page can show it before fetch. Cleared when consumed. */
  handoffTranscript: Option.Option<HandoffTranscript>;
  setHandoffTranscript: (data: Option.Option<HandoffTranscript>) => void;
  /** Anonymous chat messages saved before OAuth redirect; used by handoff when useChat has reset to []. */
  anonymousMessages: AnonymousMessage[];
  setAnonymousMessages: (messages: AnonymousMessage[]) => void;
  /** Title of the question selected during anonymous session; used as session name after handoff. */
  questionTitle: Option.Option<string>;
  setQuestionTitle: (title: Option.Option<string>) => void;
};

const persistStorage =
  typeof window !== "undefined"
    ? createJSONStorage(() => localStorage)
    : undefined;

export const useAuthHandoffStore = create<AuthHandoffStore>()(
  persist(
    (set) => ({
      pendingSessionId: Option.none(),
      setPendingAuthHandoff: (sessionId) => set({ pendingSessionId: sessionId }),
      handoffTranscript: Option.none(),
      setHandoffTranscript: (data) => set({ handoffTranscript: data }),
      anonymousMessages: [],
      setAnonymousMessages: (messages) => set({ anonymousMessages: messages }),
      questionTitle: Option.none(),
      setQuestionTitle: (title) => set({ questionTitle: title }),
    }),
    {
      name: "scalecanvas-auth-handoff",
      storage: persistStorage,
      partialize: (state) => ({
        anonymousMessages: state.anonymousMessages,
        questionTitle: Option.getOrNull(state.questionTitle),
      }),
      merge: (persistedState, currentState) => {
        const p = persistedState as {
          anonymousMessages?: AnonymousMessage[];
          questionTitle?: string | null;
        };
        return {
          ...currentState,
          anonymousMessages: p.anonymousMessages ?? currentState.anonymousMessages,
          questionTitle: Option.fromNullable(p.questionTitle),
        };
      },
      skipHydration: true,
    }
  )
);

/** Call once on client mount to rehydrate anonymousMessages from localStorage. */
export function rehydrateAuthHandoffStore(): Promise<void> | undefined {
  const store = useAuthHandoffStore as unknown as {
    persist?: { rehydrate: () => Promise<void> };
  };
  return store.persist?.rehydrate();
}
