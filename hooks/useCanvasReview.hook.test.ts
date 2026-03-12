// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Option } from "effect";

// ---------------------------------------------------------------------------
// Mocks — before imports
// ---------------------------------------------------------------------------

vi.mock("@/stores/canvasStore", async () => {
  const { create } = await import("zustand");
  const { Option: O } = await import("effect");
  const store = create(() => ({
    nodes: [{ id: "n1", position: { x: 0, y: 0 }, data: { label: "Web App" }, type: "default" }],
    edges: [],
    viewport: O.none(),
    canvasReady: true,
    getCanvasState: () => ({
      nodes: store.getState().nodes,
      edges: store.getState().edges,
    }),
  }));
  return { useCanvasStore: store };
});

vi.mock("@/lib/canvasParser", () => ({
  parseCanvasState: (nodes: ReadonlyArray<{ id: string }>, _edges: unknown) =>
    nodes.map((n) => n.id).join(",") || "empty",
}));

vi.mock("@/lib/optionHelpers", () => ({
  whenSome: <A>(opt: Option.Option<A>, fn: (a: A) => void) => {
    if (Option.isSome(opt)) fn(opt.value);
  },
}));

import { useCanvasReview } from "./useCanvasReview";
import { useCanvasStore } from "@/stores/canvasStore";

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

function mockFetchOk(text: string): void {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(text)}\n`));
      controller.close();
    },
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(stream, { status: 200 }),
  );
}

function mockFetchError(): void {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(null, { status: 500 }),
  );
}

// A fetch that never resolves — simulates an in-flight request
function mockFetchHanging(): void {
  vi.spyOn(globalThis, "fetch").mockReturnValue(
    new Promise(() => {}), // never resolves
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useCanvasReview (hook)", () => {
  const setMessages = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useCanvasStore.setState({
      nodes: [{ id: "n1", position: { x: 0, y: 0 }, data: { label: "Web App" }, type: "default" }],
      edges: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("canEvaluate is true when canvas has nodes and never evaluated", () => {
    const { result } = renderHook(() =>
      useCanvasReview({
        messages: [],
        setMessages,
        isLoading: false,
      }),
    );
    expect(result.current.canEvaluate).toBe(true);
    expect(result.current.isEvaluating).toBe(false);
  });

  it("evaluate() calls fetch and appends assistant message", async () => {
    mockFetchOk("Great diagram!");

    const { result } = renderHook(() =>
      useCanvasReview({
        messages: [],
        setMessages,
        isLoading: false,
      }),
    );

    await act(async () => {
      await result.current.evaluate();
    });

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    expect(setMessages).toHaveBeenCalledOnce();
    expect(result.current.isEvaluating).toBe(false);
  });

  it("isEvaluatingRef prevents double-evaluate on concurrent calls", async () => {
    // Use a hanging fetch so the first evaluate stays in-flight
    mockFetchHanging();

    const { result } = renderHook(() =>
      useCanvasReview({
        messages: [],
        setMessages,
        isLoading: false,
      }),
    );

    // Fire two evaluations synchronously (simulating double-click)
    act(() => {
      void result.current.evaluate();
      void result.current.evaluate();
    });

    // Only ONE fetch should have been made — the ref guard blocks the second
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("evaluate() is a no-op when isLoading is true", async () => {
    mockFetchOk("ignored");

    const { result } = renderHook(() =>
      useCanvasReview({
        messages: [],
        setMessages,
        isLoading: true,
      }),
    );

    await act(async () => {
      await result.current.evaluate();
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("evaluate() is a no-op after evaluating the same snapshot", async () => {
    mockFetchOk("First review");

    const { result } = renderHook(() =>
      useCanvasReview({
        messages: [],
        setMessages,
        isLoading: false,
      }),
    );

    // First evaluate
    await act(async () => {
      await result.current.evaluate();
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // Second evaluate with same canvas state — should be skipped
    mockFetchOk("Should not be called");
    await act(async () => {
      await result.current.evaluate();
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // still 1
  });

  it("isEvaluating resets to false after fetch error", async () => {
    mockFetchError();

    const { result } = renderHook(() =>
      useCanvasReview({
        messages: [],
        setMessages,
        isLoading: false,
      }),
    );

    await act(async () => {
      await result.current.evaluate();
    });

    expect(result.current.isEvaluating).toBe(false);
    expect(setMessages).not.toHaveBeenCalled();
  });

  it("canEvaluate becomes false when isEvaluating is true", async () => {
    // Use a hanging fetch to keep isEvaluating true
    mockFetchHanging();

    const { result } = renderHook(() =>
      useCanvasReview({
        messages: [],
        setMessages,
        isLoading: false,
      }),
    );

    expect(result.current.canEvaluate).toBe(true);

    // Start evaluation (does not await — stays in flight)
    act(() => {
      void result.current.evaluate();
    });

    // After starting, canEvaluate should be false because isEvaluating is true
    // Need to wait for React state update
    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(result.current.isEvaluating).toBe(true);
    expect(result.current.canEvaluate).toBe(false);
  });

  it("canEvaluate is false when canvas has no nodes", () => {
    useCanvasStore.setState({ nodes: [], edges: [] });

    const { result } = renderHook(() =>
      useCanvasReview({
        messages: [],
        setMessages,
        isLoading: false,
      }),
    );

    expect(result.current.canEvaluate).toBe(false);
  });
});
