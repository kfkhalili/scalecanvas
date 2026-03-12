import { describe, it, expect, vi, beforeEach } from "vitest";

function throwingSetItem(): void {
  throw new DOMException("QuotaExceededError");
}

/** Register vi.doMock (non-hoisted) for all deps and return the toast spy. */
function setupMocks(): ReturnType<typeof vi.fn> {
  const warning = vi.fn();
  vi.doMock("sonner", () => ({ toast: { warning } }));
  vi.doMock("@/stores/canvasStore", () => ({
    useCanvasStore: {
      getState: () => ({
        nodes: [],
        edges: [],
        hasAttemptedEval: false,
        viewport: { _tag: "None" },
      }),
    },
  }));
  vi.doMock("@/stores/authHandoffStore", () => ({
    useAuthHandoffStore: {
      getState: () => ({
        anonymousMessages: [],
        questionTitle: { _tag: "None" },
        questionTopicId: { _tag: "None" },
      }),
    },
  }));
  return warning;
}

describe("persistAnonymousWorkspace", () => {
  beforeEach(() => {
    // Reset the module registry so the module-level storageWarningShown flag
    // starts as false for every test.
    vi.resetModules();
    // The module guards against SSR with `typeof window === "undefined"`.
    // In the Node test environment window doesn't exist, so we stub it.
    Object.defineProperty(globalThis, "window", {
      value: globalThis,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        setItem: vi.fn(),
        getItem: vi.fn().mockReturnValue(null),
        removeItem: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  it("writes the workspace to localStorage on success", async () => {
    setupMocks();
    const { persistAnonymousWorkspace } = await import("./anonymousWorkspaceStorage");
    persistAnonymousWorkspace();
    expect(globalThis.localStorage.setItem).toHaveBeenCalledWith(
      "scalecanvas-anonymous-workspace",
      expect.any(String)
    );
  });

  it("shows a warning toast when localStorage.setItem throws", async () => {
    const warning = setupMocks();
    globalThis.localStorage.setItem = vi.fn().mockImplementationOnce(throwingSetItem);
    const { persistAnonymousWorkspace } = await import("./anonymousWorkspaceStorage");
    persistAnonymousWorkspace();
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining("Storage is full or unavailable")
    );
  });

  it("shows the toast at most once even when called many times", async () => {
    const warning = setupMocks();
    globalThis.localStorage.setItem = vi.fn().mockImplementation(throwingSetItem);
    const { persistAnonymousWorkspace } = await import("./anonymousWorkspaceStorage");
    persistAnonymousWorkspace();
    persistAnonymousWorkspace();
    persistAnonymousWorkspace();
    expect(warning).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// captureAnonymousSnapshot
// ---------------------------------------------------------------------------

describe("captureAnonymousSnapshot", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, "window", {
      value: globalThis,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: { setItem: vi.fn(), getItem: vi.fn().mockReturnValue(null), removeItem: vi.fn() },
      writable: true,
      configurable: true,
    });
  });

  it("captures nodes, edges, viewport, messages, and metadata from stores", async () => {
    vi.doMock("sonner", () => ({ toast: { warning: vi.fn() } }));
    vi.doMock("@/stores/canvasStore", () => ({
      useCanvasStore: {
        getState: () => ({
          nodes: [{ id: "n1" }],
          edges: [{ id: "e1", source: "n1", target: "n2" }],
          hasAttemptedEval: true,
          viewport: { _tag: "Some", value: { x: 10, y: 20, zoom: 2 } },
        }),
      },
    }));
    vi.doMock("@/stores/authHandoffStore", () => ({
      useAuthHandoffStore: {
        getState: () => ({
          anonymousMessages: [{ id: "m1", role: "user", content: "hi" }],
          questionTitle: { _tag: "Some", value: "My Title" },
          questionTopicId: { _tag: "Some", value: "topic-1" },
        }),
      },
    }));

    const { captureAnonymousSnapshot } = await import("./anonymousWorkspaceStorage");
    const snap = captureAnonymousSnapshot();

    expect(snap.nodes).toEqual([{ id: "n1" }]);
    expect(snap.edges).toEqual([{ id: "e1", source: "n1", target: "n2" }]);
    expect(snap.viewport).toEqual({ x: 10, y: 20, zoom: 2 });
    expect(snap.hasAttemptedEval).toBe(true);
    expect(snap.anonymousMessages).toEqual([{ id: "m1", role: "user", content: "hi" }]);
    expect(snap.questionTitle).toBe("My Title");
    expect(snap.questionTopicId).toBe("topic-1");
  });

  it("returns defensive copy of nodes and edges", async () => {
    const nodes = [{ id: "n1" }];
    const edges = [{ id: "e1" }];
    vi.doMock("sonner", () => ({ toast: { warning: vi.fn() } }));
    vi.doMock("@/stores/canvasStore", () => ({
      useCanvasStore: {
        getState: () => ({
          nodes,
          edges,
          hasAttemptedEval: false,
          viewport: { _tag: "None" },
        }),
      },
    }));
    vi.doMock("@/stores/authHandoffStore", () => ({
      useAuthHandoffStore: {
        getState: () => ({
          anonymousMessages: [],
          questionTitle: { _tag: "None" },
          questionTopicId: { _tag: "None" },
        }),
      },
    }));

    const { captureAnonymousSnapshot } = await import("./anonymousWorkspaceStorage");
    const snap = captureAnonymousSnapshot();

    expect(snap.nodes).toEqual(nodes);
    expect(snap.nodes).not.toBe(nodes);
    expect(snap.edges).toEqual(edges);
    expect(snap.edges).not.toBe(edges);
  });
});

// ---------------------------------------------------------------------------
// persistAnonymousWorkspaceFromSnapshot
// ---------------------------------------------------------------------------

describe("persistAnonymousWorkspaceFromSnapshot", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, "window", {
      value: globalThis,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: { setItem: vi.fn(), getItem: vi.fn().mockReturnValue(null), removeItem: vi.fn() },
      writable: true,
      configurable: true,
    });
  });

  it("writes the exact snapshot to localStorage", async () => {
    setupMocks();
    const { persistAnonymousWorkspaceFromSnapshot } = await import("./anonymousWorkspaceStorage");

    const snapshot = {
      anonymousMessages: [{ id: "x", role: "user" as const, content: "fixed" }],
      questionTitle: "Frozen Title",
      questionTopicId: null,
      nodes: [{ id: "frozen-node" }],
      edges: [],
      hasAttemptedEval: false,
      viewport: null,
    };

    persistAnonymousWorkspaceFromSnapshot(snapshot);

    expect(globalThis.localStorage.setItem).toHaveBeenCalledWith(
      "scalecanvas-anonymous-workspace",
      expect.any(String),
    );
    const stored = JSON.parse(
      (globalThis.localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0][1] as string,
    );
    expect(stored.state.nodes).toEqual([{ id: "frozen-node" }]);
    expect(stored.state.anonymousMessages[0].content).toBe("fixed");
    expect(stored.state.questionTitle).toBe("Frozen Title");
  });

  it("does not read stores — writes only what it receives", async () => {
    // Mock stores with data that differs from the snapshot we'll write
    vi.doMock("sonner", () => ({ toast: { warning: vi.fn() } }));
    vi.doMock("@/stores/canvasStore", () => ({
      useCanvasStore: {
        getState: () => ({
          nodes: [{ id: "live-node" }],
          edges: [{ id: "live-edge" }],
          hasAttemptedEval: true,
          viewport: { _tag: "None" },
        }),
      },
    }));
    vi.doMock("@/stores/authHandoffStore", () => ({
      useAuthHandoffStore: {
        getState: () => ({
          anonymousMessages: [{ id: "live-msg", role: "user", content: "live" }],
          questionTitle: { _tag: "Some", value: "Live Title" },
          questionTopicId: { _tag: "None" },
        }),
      },
    }));

    const { persistAnonymousWorkspaceFromSnapshot } = await import("./anonymousWorkspaceStorage");

    // Snapshot has completely different data from the mocked stores
    const snapshot = {
      anonymousMessages: [],
      questionTitle: null,
      questionTopicId: null,
      nodes: [],
      edges: [],
      hasAttemptedEval: false,
      viewport: null,
    };

    persistAnonymousWorkspaceFromSnapshot(snapshot);

    const stored = JSON.parse(
      (globalThis.localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0][1] as string,
    );
    // Should contain the snapshot data, NOT the live store data
    expect(stored.state.nodes).toEqual([]);
    expect(stored.state.anonymousMessages).toEqual([]);
    expect(stored.state.questionTitle).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readFromStorage
// ---------------------------------------------------------------------------

describe("readFromStorage", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, "window", {
      value: globalThis,
      writable: true,
      configurable: true,
    });
  });

  it("returns null when nothing is stored", async () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn(), removeItem: vi.fn() },
      writable: true,
      configurable: true,
    });
    setupMocks();
    const { readFromStorage } = await import("./anonymousWorkspaceStorage");
    expect(readFromStorage()).toBeNull();
  });

  it("parses stored workspace correctly", async () => {
    const state = {
      anonymousMessages: [{ id: "m1", role: "user", content: "hi" }],
      questionTitle: "Title",
      questionTopicId: "t1",
      nodes: [{ id: "n1" }],
      edges: [],
      hasAttemptedEval: true,
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: vi.fn().mockReturnValue(JSON.stringify({ state, version: 0 })),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
    setupMocks();
    const { readFromStorage } = await import("./anonymousWorkspaceStorage");
    expect(readFromStorage()).toEqual(state);
  });

  it("returns null for malformed JSON", async () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: vi.fn().mockReturnValue("not json{{{"),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
    setupMocks();
    const { readFromStorage } = await import("./anonymousWorkspaceStorage");
    expect(readFromStorage()).toBeNull();
  });
});
