import { create } from "zustand";

type AuthHandoffStore = {
  /** When set, ChatPanel should run BFF handoff then clear and navigate to this session. */
  pendingSessionId: string | null;
  setPendingAuthHandoff: (sessionId: string | null) => void;
};

export const useAuthHandoffStore = create<AuthHandoffStore>((set) => ({
  pendingSessionId: null,
  setPendingAuthHandoff: (sessionId) => set({ pendingSessionId: sessionId }),
}));
