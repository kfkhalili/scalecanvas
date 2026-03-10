import { describe, it, expect, beforeEach } from "vitest";
import { Option } from "effect";
import { useSessionStore } from "./sessionStore";
import type { Session } from "@/lib/types";

const session = (id: string, title: string | null = null): Session => ({
  id,
  userId: "u1",
  title,
  status: "active",
  isTrial: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  conclusionSummary: null,
});

beforeEach(() => {
  useSessionStore.setState({
    currentSessionId: Option.none(),
    sessions: [],
  });
});

describe("sessionStore", () => {
  it("starts with no sessions and no current session", () => {
    const state = useSessionStore.getState();
    expect(state.sessions).toEqual([]);
    expect(Option.isNone(state.currentSessionId)).toBe(true);
  });

  it("setSessions replaces the session list", () => {
    const list = [session("a", "Design"), session("b", "Coding")];
    useSessionStore.getState().setSessions(list);
    expect(useSessionStore.getState().sessions).toEqual(list);
  });

  it("setCurrentSessionId updates the active session", () => {
    useSessionStore.getState().setCurrentSessionId(Option.some("a"));
    expect(
      Option.match(useSessionStore.getState().currentSessionId, {
        onNone: () => null,
        onSome: (id) => id,
      })
    ).toBe("a");
  });

  it("setCurrentSessionId can clear the selection", () => {
    useSessionStore.getState().setCurrentSessionId(Option.some("a"));
    useSessionStore.getState().setCurrentSessionId(Option.none());
    expect(
      Option.isNone(useSessionStore.getState().currentSessionId)
    ).toBe(true);
  });

  it("setSessions does not affect currentSessionId", () => {
    useSessionStore.getState().setCurrentSessionId(Option.some("a"));
    useSessionStore.getState().setSessions([session("b")]);
    expect(
      Option.match(useSessionStore.getState().currentSessionId, {
        onNone: () => null,
        onSome: (id) => id,
      })
    ).toBe("a");
  });
});
