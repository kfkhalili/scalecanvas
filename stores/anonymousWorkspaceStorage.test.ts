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
