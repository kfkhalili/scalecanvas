import { Effect, Option } from "effect";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runPostAuthHandoff } from "./usePostAuthHandoff";
import { useCanvasStore } from "@/stores/canvasStore";
import { useAuthHandoffStore } from "@/stores/authHandoffStore";

describe("runPostAuthHandoff", () => {
  beforeEach(() => {
    useCanvasStore.setState({ hasAttemptedEval: false });
    useAuthHandoffStore.setState({ pendingSessionId: Option.none() });
  });

  it("when session exists and hasAttemptedEval true: resets flag and calls RPC, sets pending handoff on success", async () => {
    const sessionId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    useCanvasStore.setState({ hasAttemptedEval: true });
    const deductRpc = vi.fn().mockReturnValue(Effect.succeed(sessionId));
    const setPending = vi.fn();

    await runPostAuthHandoff(
      { data: { session: {} } },
      true,
      useCanvasStore.getState().setHasAttemptedEval,
      deductRpc,
      setPending
    );

    expect(useCanvasStore.getState().hasAttemptedEval).toBe(false);
    expect(deductRpc).toHaveBeenCalledTimes(1);
    expect(setPending).toHaveBeenCalledWith(Option.some(sessionId));
  });

  it("when hasAttemptedEval false: does not call RPC or set pending", async () => {
    const deductRpc = vi.fn();
    const setPending = vi.fn();

    await runPostAuthHandoff(
      { data: { session: {} } },
      false,
      useCanvasStore.getState().setHasAttemptedEval,
      deductRpc,
      setPending
    );

    expect(deductRpc).not.toHaveBeenCalled();
    expect(setPending).not.toHaveBeenCalled();
  });

  it("when no session: does not call RPC or set pending", async () => {
    useCanvasStore.setState({ hasAttemptedEval: true });
    const deductRpc = vi.fn();
    const setPending = vi.fn();

    await runPostAuthHandoff(
      { data: { session: null } },
      true,
      useCanvasStore.getState().setHasAttemptedEval,
      deductRpc,
      setPending
    );

    expect(deductRpc).not.toHaveBeenCalled();
    expect(setPending).not.toHaveBeenCalled();
  });

  it("when RPC returns err: resets hasAttemptedEval but does not set pending", async () => {
    useCanvasStore.setState({ hasAttemptedEval: true });
    const deductRpc = vi.fn().mockReturnValue(Effect.fail({ message: "Insufficient tokens" }));
    const setPending = vi.fn();

    await runPostAuthHandoff(
      { data: { session: {} } },
      true,
      useCanvasStore.getState().setHasAttemptedEval,
      deductRpc,
      setPending
    );

    expect(useCanvasStore.getState().hasAttemptedEval).toBe(false);
    expect(setPending).not.toHaveBeenCalled();
  });
});
