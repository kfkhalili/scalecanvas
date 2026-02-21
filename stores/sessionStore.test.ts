import { describe, it, expect, beforeEach } from "vitest";
import { useSessionStore } from "./sessionStore";
import type { Session } from "@/lib/types";

const session = (id: string, title: string | null = null): Session => ({
  id,
  userId: "u1",
  title,
  status: "active",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

beforeEach(() => {
  useSessionStore.setState({ currentSessionId: null, sessions: [], isSessionActive: true });
});

describe("sessionStore", () => {
  it("starts with no sessions and no current session", () => {
    const state = useSessionStore.getState();
    expect(state.sessions).toEqual([]);
    expect(state.currentSessionId).toBeNull();
  });

  it("setSessions replaces the session list", () => {
    const list = [session("a", "Design"), session("b", "Coding")];
    useSessionStore.getState().setSessions(list);
    expect(useSessionStore.getState().sessions).toEqual(list);
  });

  it("setCurrentSessionId updates the active session", () => {
    useSessionStore.getState().setCurrentSessionId("a");
    expect(useSessionStore.getState().currentSessionId).toBe("a");
  });

  it("setCurrentSessionId can clear the selection", () => {
    useSessionStore.getState().setCurrentSessionId("a");
    useSessionStore.getState().setCurrentSessionId(null);
    expect(useSessionStore.getState().currentSessionId).toBeNull();
  });

  it("setSessions does not affect currentSessionId", () => {
    useSessionStore.getState().setCurrentSessionId("a");
    useSessionStore.getState().setSessions([session("b")]);
    expect(useSessionStore.getState().currentSessionId).toBe("a");
  });
});
