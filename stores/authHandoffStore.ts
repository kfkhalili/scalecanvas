import { Option } from "effect";
import { create } from "zustand";
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
  /** Stable topic id for the anonymous interview; keeps question consistent across refreshes. */
  questionTopicId: Option.Option<string>;
  setQuestionTopicId: (id: Option.Option<string>) => void;
};

export const useAuthHandoffStore = create<AuthHandoffStore>()((set) => ({
  pendingSessionId: Option.none(),
  setPendingAuthHandoff: (sessionId) => set({ pendingSessionId: sessionId }),
  handoffTranscript: Option.none(),
  setHandoffTranscript: (data) => set({ handoffTranscript: data }),
  anonymousMessages: [],
  setAnonymousMessages: (messages) => set({ anonymousMessages: messages }),
  questionTitle: Option.none(),
  setQuestionTitle: (title) => set({ questionTitle: title }),
  questionTopicId: Option.none(),
  setQuestionTopicId: (id) => set({ questionTopicId: id }),
}));

/** No-op: handoff is now persisted only via anonymousWorkspaceStorage (one key). */
export function rehydrateAuthHandoffStore(): Promise<void> | undefined {
  return Promise.resolve();
}
