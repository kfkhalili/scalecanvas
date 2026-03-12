// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Effect, Option } from "effect";
import type { CanvasState, TranscriptEntry } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mocks — before imports
// ---------------------------------------------------------------------------

const mockFetchCanvas = vi.fn();
const mockFetchTranscript = vi.fn();
vi.mock("@/services/sessionsClient", () => ({
  fetchCanvas: (...args: ReadonlyArray<unknown>) => mockFetchCanvas(...args),
  fetchTranscript: (...args: ReadonlyArray<unknown>) => mockFetchTranscript(...args),
}));

let mockSignal: AbortSignal | undefined;
vi.mock("@/stores/workspaceStore", () => ({
  getSessionSignal: () => mockSignal,
}));

const mockFlush = vi.fn(async () => {});
vi.mock("@/lib/persistenceLifecycle", () => ({
  getPersistence: () => ({ flush: mockFlush }),
}));

vi.mock("@/lib/optionHelpers", () => ({
  whenSome: <A>(opt: Option.Option<A>, fn: (a: A) => void) => {
    if (Option.isSome(opt)) fn(opt.value);
  },
}));

vi.mock("@/lib/sessionLoading", () => ({
  isSessionContentReady: (
    sid: string | undefined,
    canvasReady: boolean,
    transcriptReady: boolean,
  ) => (sid ? canvasReady && transcriptReady : true),
}));

// Use real Zustand stores — they are lightweight and let us verify state writes
import { useCanvasStore } from "@/stores/canvasStore";
import { useTranscriptStore } from "@/stores/transcriptStore";
import { useAuthHandoffStore } from "@/stores/authHandoffStore";
import { useSessionContent } from "./useSessionContent";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStores(): void {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    viewport: Option.none(),
    canvasReady: false,
  });
  useTranscriptStore.setState({
    entries: [],
    transcriptReady: false,
  });
  useAuthHandoffStore.setState({
    pendingSessionId: Option.none(),
    handoffTranscript: Option.none(),
    anonymousMessages: [],
    rehydrated: true,
  });
}

function makeCanvasState(nodeIds: string[]): CanvasState {
  return {
    nodes: nodeIds.map((id) => ({
      id,
      position: { x: 0, y: 0 },
      data: {},
    })),
    edges: [],
  };
}

function makeTranscriptEntries(count: number): TranscriptEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `t-${i}`,
    sessionId: "sess-1",
    role: "user" as const,
    content: `msg-${i}`,
    createdAt: new Date().toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSessionContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
    mockSignal = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Signal passing ────────────────────────────────────────────────────

  it("passes session signal to fetchCanvas", async () => {
    const controller = new AbortController();
    mockSignal = controller.signal;
    const canvasData = makeCanvasState(["n1"]);
    mockFetchCanvas.mockReturnValue(Effect.succeed(canvasData));
    mockFetchTranscript.mockReturnValue(Effect.succeed([]));

    renderHook(() => useSessionContent("sess-1", false));
    // Let the async chain settle
    await act(() => new Promise((r) => setTimeout(r, 10)));

    expect(mockFetchCanvas).toHaveBeenCalledWith("sess-1", { signal: controller.signal });
  });

  it("passes session signal to fetchTranscript", async () => {
    const controller = new AbortController();
    mockSignal = controller.signal;
    mockFetchCanvas.mockReturnValue(Effect.succeed(makeCanvasState([])));
    mockFetchTranscript.mockReturnValue(Effect.succeed([]));

    renderHook(() => useSessionContent("sess-1", false));
    await act(() => new Promise((r) => setTimeout(r, 10)));

    expect(mockFetchTranscript).toHaveBeenCalledWith("sess-1", { signal: controller.signal });
  });

  // ── Abort guard ───────────────────────────────────────────────────────

  it("does not write canvas state when signal is aborted before callback", async () => {
    const controller = new AbortController();
    mockSignal = controller.signal;

    // fetchCanvas returns a value, but signal will be aborted before the .then runs
    const canvasData = makeCanvasState(["n1", "n2"]);
    mockFetchCanvas.mockImplementation(() => {
      // Abort the signal DURING the fetch — simulates session switch
      controller.abort();
      return Effect.succeed(canvasData);
    });
    mockFetchTranscript.mockReturnValue(Effect.succeed([]));

    renderHook(() => useSessionContent("sess-1", false));
    await act(() => new Promise((r) => setTimeout(r, 10)));

    // Canvas state should NOT have the fetched nodes — signal was aborted
    const state = useCanvasStore.getState();
    expect(state.nodes).toEqual([]);
  });

  it("does not write transcript entries when signal is aborted before callback", async () => {
    const controller = new AbortController();
    mockSignal = controller.signal;

    const entries = makeTranscriptEntries(3);
    mockFetchCanvas.mockReturnValue(Effect.succeed(makeCanvasState([])));
    mockFetchTranscript.mockImplementation(() => {
      controller.abort();
      return Effect.succeed(entries);
    });

    renderHook(() => useSessionContent("sess-1", false));
    await act(() => new Promise((r) => setTimeout(r, 10)));

    // Transcript entries should NOT have been written
    expect(useTranscriptStore.getState().entries).toEqual([]);
  });

  // ── Normal fetch ──────────────────────────────────────────────────────

  it("writes canvas state on successful fetch with active signal", async () => {
    const controller = new AbortController();
    mockSignal = controller.signal;
    const canvasData = makeCanvasState(["n1"]);
    mockFetchCanvas.mockReturnValue(Effect.succeed(canvasData));
    mockFetchTranscript.mockReturnValue(Effect.succeed([]));

    renderHook(() => useSessionContent("sess-1", false));
    await act(() => new Promise((r) => setTimeout(r, 10)));

    expect(useCanvasStore.getState().nodes.length).toBe(1);
    expect(useCanvasStore.getState().canvasReady).toBe(true);
  });

  it("writes transcript entries on successful fetch with active signal", async () => {
    const controller = new AbortController();
    mockSignal = controller.signal;
    const entries = makeTranscriptEntries(2);
    mockFetchCanvas.mockReturnValue(Effect.succeed(makeCanvasState([])));
    mockFetchTranscript.mockReturnValue(Effect.succeed(entries));

    renderHook(() => useSessionContent("sess-1", false));
    await act(() => new Promise((r) => setTimeout(r, 10)));

    expect(useTranscriptStore.getState().entries.length).toBe(2);
    expect(useTranscriptStore.getState().transcriptReady).toBe(true);
  });

  // ── Session switch flushes persistence ────────────────────────────────

  it("flushes persistence when switching sessions", async () => {
    mockFetchCanvas.mockReturnValue(Effect.succeed(makeCanvasState([])));
    mockFetchTranscript.mockReturnValue(Effect.succeed([]));

    const { rerender } = renderHook(
      ({ sid }: { sid: string }) => useSessionContent(sid, false),
      { initialProps: { sid: "sess-1" } },
    );
    await act(() => new Promise((r) => setTimeout(r, 10)));

    // Switch to a different session
    rerender({ sid: "sess-2" });
    await act(() => new Promise((r) => setTimeout(r, 10)));

    expect(mockFlush).toHaveBeenCalled();
  });

  // ── No sessionId ──────────────────────────────────────────────────────

  it("sets canvasReady true immediately when no sessionId", () => {
    renderHook(() => useSessionContent(undefined, true));
    expect(useCanvasStore.getState().canvasReady).toBe(true);
  });

  // ── Fetch error ───────────────────────────────────────────────────────

  it("sets canvasReady true even on fetch failure", async () => {
    mockSignal = new AbortController().signal;
    mockFetchCanvas.mockReturnValue(
      Effect.fail({ _tag: "ApiError" as const, message: "500" }),
    );
    mockFetchTranscript.mockReturnValue(Effect.succeed([]));

    renderHook(() => useSessionContent("sess-1", false));
    await act(() => new Promise((r) => setTimeout(r, 10)));

    expect(useCanvasStore.getState().canvasReady).toBe(true);
  });
});
