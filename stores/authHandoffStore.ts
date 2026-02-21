import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TranscriptEntry } from "@/lib/types";

/** Message shape for anonymous chat backup (survives OAuth redirect). */
export type AnonymousMessage = { id: string; role: string; content: string };

type AuthHandoffStore = {
  /** When set, ChatPanel should run BFF handoff then clear and navigate to this session. */
  pendingSessionId: string | null;
  setPendingAuthHandoff: (sessionId: string | null) => void;
  /** Transcript carried across handoff so the session page can show it before fetch. Cleared when consumed. */
  handoffTranscript: { sessionId: string; entries: TranscriptEntry[] } | null;
  setHandoffTranscript: (data: { sessionId: string; entries: TranscriptEntry[] } | null) => void;
  /** Anonymous chat messages saved before OAuth redirect; used by handoff when useChat has reset to []. */
  anonymousMessages: AnonymousMessage[];
  setAnonymousMessages: (messages: AnonymousMessage[]) => void;
  /** Title of the question selected during anonymous session; used as session name after handoff. */
  questionTitle: string | null;
  setQuestionTitle: (title: string | null) => void;
};

const persistStorage =
  typeof window !== "undefined"
    ? createJSONStorage(() => localStorage)
    : undefined;

export const useAuthHandoffStore = create<AuthHandoffStore>()(
  persist(
    (set) => ({
      pendingSessionId: null,
      setPendingAuthHandoff: (sessionId) => set({ pendingSessionId: sessionId }),
      handoffTranscript: null,
      setHandoffTranscript: (data) => set({ handoffTranscript: data }),
      anonymousMessages: [],
      setAnonymousMessages: (messages) => set({ anonymousMessages: messages }),
      questionTitle: null,
      setQuestionTitle: (title) => set({ questionTitle: title }),
    }),
    {
      name: "scalecanvas-auth-handoff",
      storage: persistStorage,
      partialize: (state) => ({
        anonymousMessages: state.anonymousMessages,
        questionTitle: state.questionTitle,
      }),
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
