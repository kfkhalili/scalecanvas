import { describe, it, expect, beforeEach } from "vitest";
import { Option } from "effect";
import { useAuthHandoffStore } from "./authHandoffStore";

beforeEach(() => {
  useAuthHandoffStore.setState({
    pendingSessionId: Option.none(),
    handoffTranscript: Option.none(),
    anonymousMessages: [],
    questionTitle: Option.none(),
    questionTopicId: Option.none(),
    rehydrated: false,
    handoffStatus: "idle",
  });
});

describe("authHandoffStore", () => {
  it("initial handoffStatus is idle", () => {
    expect(useAuthHandoffStore.getState().handoffStatus).toBe("idle");
  });

  it("setHandoffStatus transitions through lifecycle", () => {
    const { setHandoffStatus } = useAuthHandoffStore.getState();

    setHandoffStatus("in-progress");
    expect(useAuthHandoffStore.getState().handoffStatus).toBe("in-progress");

    setHandoffStatus("done");
    expect(useAuthHandoffStore.getState().handoffStatus).toBe("done");
  });

  it("setHandoffStatus to error", () => {
    useAuthHandoffStore.getState().setHandoffStatus("error");
    expect(useAuthHandoffStore.getState().handoffStatus).toBe("error");
  });

  it("setPendingAuthHandoff syncs to sessionStorage", () => {
    const { setPendingAuthHandoff } = useAuthHandoffStore.getState();
    setPendingAuthHandoff(Option.some("test-session-id"));
    expect(Option.isSome(useAuthHandoffStore.getState().pendingSessionId)).toBe(true);

    setPendingAuthHandoff(Option.none());
    expect(Option.isNone(useAuthHandoffStore.getState().pendingSessionId)).toBe(true);
  });
});
