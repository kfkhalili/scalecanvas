import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

const mockPersistAnonymousWorkspace = vi.fn();
vi.mock("@/stores/anonymousWorkspaceStorage", () => ({
  persistAnonymousWorkspace: (...args: ReadonlyArray<unknown>) =>
    mockPersistAnonymousWorkspace(...args),
}));

const mockSaveCanvasApi = vi.fn();
vi.mock("@/services/sessionsClient", () => ({
  saveCanvasApi: (...args: ReadonlyArray<unknown>) =>
    mockSaveCanvasApi(...args),
}));

// Zustand subscribe stubs — each returns an unsubscribe spy
const canvasUnsub = vi.fn();
const authUnsub = vi.fn();
const canvasSubscribe = vi.fn((_cb: () => void) => canvasUnsub);
const authSubscribe = vi.fn((_cb: () => void) => authUnsub);
const mockGetCanvasState = vi.fn(() => ({
  nodes: [],
  edges: [],
  viewport: null,
}));

vi.mock("@/stores/canvasStore", () => ({
  useCanvasStore: {
    subscribe: (cb: () => void) => canvasSubscribe(cb),
    getState: () => ({
      getCanvasState: mockGetCanvasState,
    }),
  },
}));

vi.mock("@/stores/authHandoffStore", () => ({
  useAuthHandoffStore: {
    subscribe: (cb: () => void) => authSubscribe(cb),
  },
}));

// Workspace store mock — real subscribe semantics for bridge tests
type WorkspaceStoreListener = (
  state: { phase: { phase: string; sessionId?: string } },
  prevState: { phase: { phase: string; sessionId?: string } },
) => void;
const workspaceListeners = new Set<WorkspaceStoreListener>();
let workspacePhase: { phase: string; sessionId?: string } = { phase: "boot" };

vi.mock("@/stores/workspaceStore", () => ({
  useWorkspaceStore: {
    subscribe: (cb: WorkspaceStoreListener) => {
      workspaceListeners.add(cb);
      return () => workspaceListeners.delete(cb);
    },
    getState: () => ({ phase: workspacePhase }),
  },
}));

// Workspace phase derived queries
vi.mock("@/lib/workspacePhase", () => ({
  persistenceMode: (wp: { phase: string }): string => {
    if (wp.phase === "anonymous") return "local";
    if (wp.phase === "active") return "api";
    return "none";
  },
  sessionIdOf: (wp: { phase: string; sessionId?: string }): string | undefined =>
    wp.sessionId,
}));

/** Simulate a workspace store phase change (fires bridge subscriptions). */
function simulatePhaseChange(
  next: { phase: string; sessionId?: string },
): void {
  const prev = workspacePhase;
  workspacePhase = next;
  for (const cb of workspaceListeners) cb({ phase: next }, { phase: prev });
}

import { Effect } from "effect";
import {
  getPersistence,
  swapPersistence,
  teardownPersistence,
  initPersistenceBridge,
} from "./persistenceLifecycle";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset the singleton to a clean state between tests. */
function resetModule(): void {
  teardownPersistence();
  workspacePhase = { phase: "boot" };
  workspaceListeners.clear();
  vi.clearAllMocks();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("persistenceLifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetModule();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // getPersistence — initial state
  // -----------------------------------------------------------------------

  describe("getPersistence", () => {
    it("returns a null persistence service initially", () => {
      const svc = getPersistence();
      // Null persistence does nothing — markDirty is a no-op
      svc.markDirty();
      expect(svc.getState().isDirty).toBe(false);
    });

    it("flush on null persistence resolves immediately", async () => {
      await getPersistence().flush();
    });
  });

  // -----------------------------------------------------------------------
  // swapPersistence — "local" mode
  // -----------------------------------------------------------------------

  describe('swapPersistence("local")', () => {
    it("creates a live persistence service", () => {
      swapPersistence("local");
      const svc = getPersistence();
      svc.markDirty();
      expect(svc.getState().isDirty).toBe(true);
    });

    it("subscribes to canvasStore and authHandoffStore", () => {
      swapPersistence("local");
      expect(canvasSubscribe).toHaveBeenCalledOnce();
      expect(authSubscribe).toHaveBeenCalledOnce();
    });

    it("calls persistAnonymousWorkspace on write", async () => {
      swapPersistence("local");
      getPersistence().markDirty();
      await vi.advanceTimersByTimeAsync(500);
      expect(mockPersistAnonymousWorkspace).toHaveBeenCalledOnce();
    });

    it("auto-marks dirty when canvasStore changes", () => {
      swapPersistence("local");
      // The subscribe callback should markDirty on the current persistence
      const canvasCb = canvasSubscribe.mock.calls[0]![0];
      canvasCb();
      expect(getPersistence().getState().isDirty).toBe(true);
    });

    it("auto-marks dirty when authHandoffStore changes", () => {
      swapPersistence("local");
      const authCb = authSubscribe.mock.calls[0]![0];
      authCb();
      expect(getPersistence().getState().isDirty).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // swapPersistence — "api" mode
  // -----------------------------------------------------------------------

  describe('swapPersistence("api")', () => {
    it("creates a live persistence service", () => {
      mockSaveCanvasApi.mockReturnValue(Effect.succeed(undefined));
      swapPersistence("api", "sess-1");
      const svc = getPersistence();
      svc.markDirty();
      expect(svc.getState().isDirty).toBe(true);
    });

    it("subscribes to canvasStore only", () => {
      mockSaveCanvasApi.mockReturnValue(Effect.succeed(undefined));
      swapPersistence("api", "sess-1");
      expect(canvasSubscribe).toHaveBeenCalledOnce();
      expect(authSubscribe).not.toHaveBeenCalled();
    });

    it("calls saveCanvasApi with session id on write", async () => {
      mockSaveCanvasApi.mockReturnValue(Effect.succeed(undefined));
      swapPersistence("api", "sess-1");
      getPersistence().markDirty();
      await vi.advanceTimersByTimeAsync(500);
      expect(mockSaveCanvasApi).toHaveBeenCalledWith(
        "sess-1",
        expect.objectContaining({ nodes: [], edges: [] }),
      );
    });

    it("falls back to null persistence when sessionId is missing", () => {
      swapPersistence("api");
      const svc = getPersistence();
      svc.markDirty();
      expect(svc.getState().isDirty).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // swapPersistence — "none" mode
  // -----------------------------------------------------------------------

  describe('swapPersistence("none")', () => {
    it("creates a null persistence service", () => {
      swapPersistence("none");
      const svc = getPersistence();
      svc.markDirty();
      expect(svc.getState().isDirty).toBe(false);
    });

    it("does not subscribe to any store", () => {
      swapPersistence("none");
      expect(canvasSubscribe).not.toHaveBeenCalled();
      expect(authSubscribe).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Swap transitions
  // -----------------------------------------------------------------------

  describe("swap transitions", () => {
    it("flushes the previous persistence before swapping", async () => {
      swapPersistence("local");
      getPersistence().markDirty();
      // Now swap to "none" — should flush, triggering a write
      swapPersistence("none");
      // The flush from swap is fire-and-forget but uses the old write fn
      await vi.advanceTimersByTimeAsync(0);
      expect(mockPersistAnonymousWorkspace).toHaveBeenCalledOnce();
    });

    it("unsubscribes old store listeners on swap", () => {
      swapPersistence("local");
      expect(canvasUnsub).not.toHaveBeenCalled();
      expect(authUnsub).not.toHaveBeenCalled();

      swapPersistence("none");
      expect(canvasUnsub).toHaveBeenCalledOnce();
      expect(authUnsub).toHaveBeenCalledOnce();
    });

    it("local → api: switches subscriptions correctly", () => {
      mockSaveCanvasApi.mockReturnValue(Effect.succeed(undefined));
      swapPersistence("local");
      expect(canvasSubscribe).toHaveBeenCalledTimes(1);
      expect(authSubscribe).toHaveBeenCalledTimes(1);

      swapPersistence("api", "sess-2");
      // Old unsubs called
      expect(canvasUnsub).toHaveBeenCalled();
      expect(authUnsub).toHaveBeenCalled();
      // New canvas subscription
      expect(canvasSubscribe).toHaveBeenCalledTimes(2);
      // Auth not subscribed in api mode
      expect(authSubscribe).toHaveBeenCalledTimes(1);
    });

    it("none → none is idempotent (no-op)", () => {
      // Start from guaranteed "none" state (initial)
      swapPersistence("none");
      const _before = getPersistence();
      swapPersistence("none");
      // Same null persistence — no store churn
      expect(canvasSubscribe).not.toHaveBeenCalled();
      expect(authSubscribe).not.toHaveBeenCalled();
    });

    it("local → none → local creates a fresh persistence", () => {
      swapPersistence("local");
      const first = getPersistence();
      swapPersistence("none");
      swapPersistence("local");
      const second = getPersistence();
      expect(second).not.toBe(first);
    });
  });

  // -----------------------------------------------------------------------
  // teardownPersistence
  // -----------------------------------------------------------------------

  describe("teardownPersistence", () => {
    it("flushes and resets to null persistence", async () => {
      swapPersistence("local");
      getPersistence().markDirty();
      teardownPersistence();
      // After teardown, getPersistence returns a null service
      const svc = getPersistence();
      svc.markDirty();
      expect(svc.getState().isDirty).toBe(false);
      // Pending flush completes
      await vi.advanceTimersByTimeAsync(0);
      expect(mockPersistAnonymousWorkspace).toHaveBeenCalledOnce();
    });

    it("unsubscribes all store listeners", () => {
      swapPersistence("local");
      teardownPersistence();
      expect(canvasUnsub).toHaveBeenCalledOnce();
      expect(authUnsub).toHaveBeenCalledOnce();
    });

    it("is safe to call multiple times", () => {
      swapPersistence("local");
      teardownPersistence();
      teardownPersistence();
      // Should not throw or double-unsub
      expect(canvasUnsub).toHaveBeenCalledOnce();
    });
  });

  // -----------------------------------------------------------------------
  // initPersistenceBridge
  // -----------------------------------------------------------------------

  describe("initPersistenceBridge", () => {
    it("auto-swaps to local when phase changes to anonymous", () => {
      initPersistenceBridge();
      simulatePhaseChange({ phase: "anonymous" });
      const svc = getPersistence();
      svc.markDirty();
      expect(svc.getState().isDirty).toBe(true);
      expect(canvasSubscribe).toHaveBeenCalled();
      expect(authSubscribe).toHaveBeenCalled();
    });

    it("auto-swaps to api when phase changes to active", async () => {
      mockSaveCanvasApi.mockReturnValue(Effect.succeed(undefined));
      initPersistenceBridge();
      simulatePhaseChange({ phase: "loading-session", sessionId: "sess-bridge" });
      simulatePhaseChange({ phase: "active", sessionId: "sess-bridge" });
      getPersistence().markDirty();
      await vi.advanceTimersByTimeAsync(500);
      expect(mockSaveCanvasApi).toHaveBeenCalledWith(
        "sess-bridge",
        expect.objectContaining({ nodes: [], edges: [] }),
      );
    });

    it("auto-swaps to none when phase changes to inactive", () => {
      mockSaveCanvasApi.mockReturnValue(Effect.succeed(undefined));
      initPersistenceBridge();
      simulatePhaseChange({ phase: "active", sessionId: "sess-x" });

      simulatePhaseChange({ phase: "inactive", sessionId: "sess-x" });
      // canvasStore subscription was torn down
      expect(canvasUnsub).toHaveBeenCalled();
      // New persistence is null
      const svc = getPersistence();
      svc.markDirty();
      expect(svc.getState().isDirty).toBe(false);
    });

    it("ignores phase changes with same name", () => {
      initPersistenceBridge();
      simulatePhaseChange({ phase: "boot" });
      // Still null persistence — no swap happened
      const svc = getPersistence();
      svc.markDirty();
      expect(svc.getState().isDirty).toBe(false);
      expect(canvasSubscribe).not.toHaveBeenCalled();
    });

    it("returns cleanup that unsubscribes from workspace store", () => {
      const cleanup = initPersistenceBridge();
      cleanup();
      // Phase changes after cleanup should not trigger swaps
      simulatePhaseChange({ phase: "anonymous" });
      const svc = getPersistence();
      svc.markDirty();
      expect(svc.getState().isDirty).toBe(false);
      expect(canvasSubscribe).not.toHaveBeenCalled();
    });

    it("is idempotent — re-init replaces old subscription", () => {
      initPersistenceBridge();
      initPersistenceBridge();
      // Only one effective subscription — simulate phase change
      simulatePhaseChange({ phase: "anonymous" });
      const svc = getPersistence();
      svc.markDirty();
      expect(svc.getState().isDirty).toBe(true);
    });

    it("full journey: boot → anonymous → (reset) → loading → active → inactive", async () => {
      mockSaveCanvasApi.mockReturnValue(Effect.succeed(undefined));
      initPersistenceBridge();

      // 1. anonymous
      simulatePhaseChange({ phase: "anonymous" });
      getPersistence().markDirty();
      await vi.advanceTimersByTimeAsync(500);
      expect(mockPersistAnonymousWorkspace).toHaveBeenCalledOnce();

      // 2. reset → boot (simulates page navigation)
      simulatePhaseChange({ phase: "boot" });
      // Persistence swapped to none, old local persistence flushed
      const svcAfterReset = getPersistence();
      svcAfterReset.markDirty();
      expect(svcAfterReset.getState().isDirty).toBe(false);

      // 3. loading-session (no persistence)
      simulatePhaseChange({ phase: "loading-session", sessionId: "sess-j" });

      // 4. active (api persistence)
      simulatePhaseChange({ phase: "active", sessionId: "sess-j" });
      getPersistence().markDirty();
      await vi.advanceTimersByTimeAsync(500);
      expect(mockSaveCanvasApi).toHaveBeenCalledWith(
        "sess-j",
        expect.objectContaining({ nodes: [], edges: [] }),
      );

      // 5. inactive (none persistence)
      simulatePhaseChange({ phase: "inactive", sessionId: "sess-j" });
      const svcInactive = getPersistence();
      svcInactive.markDirty();
      expect(svcInactive.getState().isDirty).toBe(false);
    });
  });
});
