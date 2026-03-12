// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { Effect, Option } from "effect";
import type { RunBffHandoffParams } from "@/lib/authHandoff";

// ---------------------------------------------------------------------------
// Mocks — before imports
// ---------------------------------------------------------------------------

const mockRouterReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
}));

// Track calls to runBffHandoff and capture its params for later invocation
const mockRunBffHandoff = vi.fn<(params: RunBffHandoffParams) => Promise<void>>();
vi.mock("@/lib/authHandoff", () => ({
  runBffHandoff: (params: RunBffHandoffParams) => mockRunBffHandoff(params),
  buildTranscriptEntries: (sid: string, _msgs: unknown[], ts: string) => [
    { id: "t1", sessionId: sid, role: "user", content: "hi", createdAt: ts },
  ],
  resolveHandoffMessages: (_msgs: unknown[], anonMsgs: unknown[]) => anonMsgs,
}));

vi.mock("@/stores/anonymousWorkspaceStorage", () => ({
  loadAnonymousWorkspace: vi.fn(),
  readFromStorage: vi.fn(() => null),
  writeToStorage: vi.fn(),
  removeFromStorage: vi.fn(),
  captureAnonymousSnapshot: vi.fn(() => null),
  persistAnonymousWorkspaceFromSnapshot: vi.fn(),
}));

vi.mock("@/services/sessionsClient", () => ({
  appendTranscriptBatchApi: () => Effect.succeed(undefined),
  saveCanvasApi: () => Effect.succeed(undefined),
}));

const mockToast = {
  loading: vi.fn((_msg: string) => "toast-id"),
  dismiss: vi.fn((_id: string) => {}),
  error: vi.fn((_msg: string) => {}),
};
vi.mock("sonner", () => ({
  toast: {
    loading: (msg: string) => mockToast.loading(msg),
    dismiss: (id: string) => mockToast.dismiss(id),
    error: (msg: string) => mockToast.error(msg),
  },
}));

vi.mock("@/lib/optionHelpers", () => ({
  whenSome: <A>(opt: Option.Option<A>, fn: (a: A) => void) => {
    if (Option.isSome(opt)) fn(opt.value);
  },
}));

import { useAuthHandoffStore } from "@/stores/authHandoffStore";
import { useAuthHandoff } from "./useAuthHandoff";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStores(): void {
  useAuthHandoffStore.setState({
    pendingSessionId: Option.none(),
    handoffTranscript: Option.none(),
    anonymousMessages: [{ id: "m1", role: "user", content: "Hello" }],
    handoffStatus: "idle",
    rehydrated: true,
  });
}

const defaultProps = {
  messages: [{ id: "m1", role: "user" as const, content: "Hello" }],
  setMessages: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAuthHandoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("does nothing when pendingSessionId is none", () => {
    renderHook(() => useAuthHandoff(defaultProps));
    expect(mockRunBffHandoff).not.toHaveBeenCalled();
  });

  it("triggers runBffHandoff when pendingSessionId is set", async () => {
    useAuthHandoffStore.setState({
      pendingSessionId: Option.some("sess-123"),
    });

    renderHook(() => useAuthHandoff(defaultProps));

    // Wait for effect to fire
    await vi.waitFor(() => {
      expect(mockRunBffHandoff).toHaveBeenCalledOnce();
    });

    expect(mockToast.loading).toHaveBeenCalledWith("Saving your session…");
    expect(useAuthHandoffStore.getState().handoffStatus).toBe("in-progress");
  });

  it("handoffDoneRef prevents duplicate triggers for same session", async () => {
    useAuthHandoffStore.setState({
      pendingSessionId: Option.some("sess-123"),
    });

    const { rerender } = renderHook(() => useAuthHandoff(defaultProps));

    await vi.waitFor(() => {
      expect(mockRunBffHandoff).toHaveBeenCalledOnce();
    });

    // Re-render with same pendingSessionId — should NOT trigger again
    rerender();
    expect(mockRunBffHandoff).toHaveBeenCalledOnce();
  });

  it("onHandoffComplete updates stores and navigates when mounted", async () => {
    useAuthHandoffStore.setState({
      pendingSessionId: Option.some("sess-456"),
    });

    // Make runBffHandoff call onHandoffComplete immediately
    mockRunBffHandoff.mockImplementation(async (params: RunBffHandoffParams) => {
      params.onHandoffComplete("sess-456", [{ id: "m1", role: "user", content: "Hello" }]);
    });

    renderHook(() => useAuthHandoff(defaultProps));

    await vi.waitFor(() => {
      expect(mockToast.dismiss).toHaveBeenCalledWith("toast-id");
    });

    expect(useAuthHandoffStore.getState().handoffStatus).toBe("done");
    expect(mockRouterReplace).toHaveBeenCalledWith("/sess-456");
  });

  it("mountedRef prevents store updates after unmount (onHandoffComplete)", async () => {
    useAuthHandoffStore.setState({
      pendingSessionId: Option.some("sess-789"),
    });

    // Hold onto onHandoffComplete to call after unmount
    let onHandoffComplete: RunBffHandoffParams["onHandoffComplete"] | null = null;
    mockRunBffHandoff.mockImplementation(async (params: RunBffHandoffParams) => {
      onHandoffComplete = params.onHandoffComplete;
      // Do NOT call the callback yet — we'll unmount first
    });

    const { unmount } = renderHook(() => useAuthHandoff(defaultProps));

    await vi.waitFor(() => {
      expect(mockRunBffHandoff).toHaveBeenCalledOnce();
    });

    // Unmount the component
    unmount();

    // Now call onHandoffComplete after unmount
    expect(onHandoffComplete).not.toBeNull();
    onHandoffComplete!("sess-789", [{ id: "m1", role: "user", content: "Hello" }]);

    // toast.dismiss should still fire (safe to call after unmount)
    expect(mockToast.dismiss).toHaveBeenCalled();

    // But store updates should NOT have happened
    expect(useAuthHandoffStore.getState().handoffStatus).toBe("in-progress"); // not "done"
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("mountedRef prevents store updates after unmount (onCanvasSaveError)", async () => {
    useAuthHandoffStore.setState({
      pendingSessionId: Option.some("sess-err"),
    });

    let onCanvasSaveError: RunBffHandoffParams["onCanvasSaveError"] | null = null;
    mockRunBffHandoff.mockImplementation(async (params: RunBffHandoffParams) => {
      onCanvasSaveError = params.onCanvasSaveError;
    });

    const { unmount } = renderHook(() => useAuthHandoff(defaultProps));

    await vi.waitFor(() => {
      expect(mockRunBffHandoff).toHaveBeenCalledOnce();
    });

    unmount();

    expect(onCanvasSaveError).not.toBeNull();
    onCanvasSaveError!();

    // toast.dismiss fires (unconditional)
    expect(mockToast.dismiss).toHaveBeenCalled();
    // But handoff status should NOT be set to "error"
    expect(useAuthHandoffStore.getState().handoffStatus).toBe("in-progress");
    // toast.error should NOT fire (behind mountedRef guard)
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("mountedRef prevents store updates after unmount (onTranscriptSaveError)", async () => {
    useAuthHandoffStore.setState({
      pendingSessionId: Option.some("sess-terr"),
    });

    let onTranscriptSaveError: NonNullable<RunBffHandoffParams["onTranscriptSaveError"]> | null = null;
    mockRunBffHandoff.mockImplementation(async (params: RunBffHandoffParams) => {
      onTranscriptSaveError = params.onTranscriptSaveError ?? null;
    });

    const { unmount } = renderHook(() => useAuthHandoff(defaultProps));

    await vi.waitFor(() => {
      expect(mockRunBffHandoff).toHaveBeenCalledOnce();
    });

    unmount();

    expect(onTranscriptSaveError).not.toBeNull();
    onTranscriptSaveError!();

    // toast.dismiss fires (unconditional)
    expect(mockToast.dismiss).toHaveBeenCalled();
    // handoffStatus should NOT be updated
    expect(useAuthHandoffStore.getState().handoffStatus).toBe("in-progress");
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});
