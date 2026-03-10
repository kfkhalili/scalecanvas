import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createPersistence,
  createNullPersistence,
  INITIAL_PERSIST_STATE,
  DEFAULT_DEBOUNCE_MS,
  type PersistState,
} from "./persistence";

// ---------------------------------------------------------------------------
// createPersistence
// ---------------------------------------------------------------------------

describe("createPersistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with clean state", () => {
    const p = createPersistence(async () => {});
    expect(p.getState()).toEqual(INITIAL_PERSIST_STATE);
  });

  it("markDirty sets isDirty immediately", () => {
    const p = createPersistence(async () => {});
    p.markDirty();
    expect(p.getState().isDirty).toBe(true);
    expect(p.getState().isSaving).toBe(false);
  });

  it("writes after debounce period", async () => {
    const writes: number[] = [];
    const p = createPersistence(async () => {
      writes.push(1);
    });
    p.markDirty();
    expect(writes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_MS);
    expect(writes).toHaveLength(1);
    expect(p.getState().isDirty).toBe(false);
    expect(p.getState().lastSavedAt).not.toBeNull();
  });

  it("does not write before debounce period", async () => {
    const writes: number[] = [];
    const p = createPersistence(async () => {
      writes.push(1);
    });
    p.markDirty();
    await vi.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_MS - 1);
    expect(writes).toHaveLength(0);
  });

  it("resets debounce timer on subsequent markDirty calls", async () => {
    const writes: number[] = [];
    const p = createPersistence(async () => {
      writes.push(1);
    });
    p.markDirty();
    await vi.advanceTimersByTimeAsync(300);
    p.markDirty();
    await vi.advanceTimersByTimeAsync(300);
    expect(writes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(writes).toHaveLength(1);
  });

  it("flush writes immediately and cancels pending timer", async () => {
    const writes: number[] = [];
    const p = createPersistence(async () => {
      writes.push(1);
    });
    p.markDirty();
    await p.flush();
    expect(writes).toHaveLength(1);
    expect(p.getState().isDirty).toBe(false);
    await vi.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_MS);
    expect(writes).toHaveLength(1);
  });

  it("flush is no-op when not dirty", async () => {
    const writes: number[] = [];
    const p = createPersistence(async () => {
      writes.push(1);
    });
    await p.flush();
    expect(writes).toHaveLength(0);
  });

  it("flush awaits inflight write then writes again if still dirty", async () => {
    let writeCount = 0;
    let resolveFirst: (() => void) | null = null;
    const p = createPersistence(() => {
      writeCount++;
      if (writeCount === 1) {
        return new Promise<void>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve();
    });

    p.markDirty();
    await vi.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_MS);
    expect(writeCount).toBe(1);
    expect(p.getState().isSaving).toBe(true);

    p.markDirty();

    const flushPromise = p.flush();
    resolveFirst!();
    await flushPromise;

    expect(writeCount).toBe(2);
    expect(p.getState().isDirty).toBe(false);
  });

  it("surfaces write errors in state", async () => {
    const p = createPersistence(async () => {
      throw new Error("disk full");
    });
    p.markDirty();
    await vi.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_MS);
    expect(p.getState().error).toBe("disk full");
    expect(p.getState().isSaving).toBe(false);
    expect(p.getState().isDirty).toBe(true);
  });

  it("does not clear error on markDirty", async () => {
    const p = createPersistence(async () => {
      throw new Error("disk full");
    });
    p.markDirty();
    await vi.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_MS);
    expect(p.getState().error).toBe("disk full");
    p.markDirty();
    expect(p.getState().error).toBe("disk full");
  });

  it("clears error on successful write after failure", async () => {
    let shouldFail = true;
    const p = createPersistence(async () => {
      if (shouldFail) throw new Error("disk full");
    });
    p.markDirty();
    await vi.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_MS);
    expect(p.getState().error).toBe("disk full");

    shouldFail = false;
    p.markDirty();
    await vi.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_MS);
    expect(p.getState().error).toBeNull();
    expect(p.getState().isDirty).toBe(false);
  });

  it("isDirty stays true when markDirty called during write", async () => {
    let resolveWrite: (() => void) | null = null;
    const p = createPersistence(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );

    p.markDirty();
    await vi.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_MS);
    expect(p.getState().isSaving).toBe(true);

    p.markDirty();
    resolveWrite!();
    await Promise.resolve();

    expect(p.getState().isDirty).toBe(true);
    expect(p.getState().isSaving).toBe(false);
  });

  it("subscribe notifies on state changes", () => {
    const p = createPersistence(async () => {});
    const states: PersistState[] = [];
    p.subscribe((s) => states.push({ ...s }));

    p.markDirty();
    expect(states).toHaveLength(1);
    expect(states[0].isDirty).toBe(true);
  });

  it("unsubscribe stops notifications", () => {
    const p = createPersistence(async () => {});
    const states: PersistState[] = [];
    const unsub = p.subscribe((s) => states.push({ ...s }));
    unsub();

    p.markDirty();
    expect(states).toHaveLength(0);
  });

  it("destroy cancels pending timer", async () => {
    const writes: number[] = [];
    const p = createPersistence(async () => {
      writes.push(1);
    });
    p.markDirty();
    p.destroy();
    await vi.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_MS);
    expect(writes).toHaveLength(0);
  });

  it("destroy clears listeners", () => {
    const p = createPersistence(async () => {});
    const states: PersistState[] = [];
    p.subscribe((s) => states.push({ ...s }));
    p.destroy();

    p.markDirty();
    expect(states).toHaveLength(0);
  });

  it("handles non-Error exceptions", async () => {
    const p = createPersistence(async () => {
      throw Object.create(null);
    });
    p.markDirty();
    await vi.advanceTimersByTimeAsync(DEFAULT_DEBOUNCE_MS);
    expect(p.getState().error).toBe("Persistence write failed");
  });

  it("respects custom debounce timing", async () => {
    const writes: number[] = [];
    const p = createPersistence(
      async () => {
        writes.push(1);
      },
      { debounceMs: 200 },
    );
    p.markDirty();
    await vi.advanceTimersByTimeAsync(200);
    expect(writes).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// createNullPersistence
// ---------------------------------------------------------------------------

describe("createNullPersistence", () => {
  it("getState always returns initial state", () => {
    const p = createNullPersistence();
    expect(p.getState()).toEqual(INITIAL_PERSIST_STATE);
  });

  it("markDirty does not change state", () => {
    const p = createNullPersistence();
    p.markDirty();
    expect(p.getState()).toEqual(INITIAL_PERSIST_STATE);
  });

  it("flush resolves immediately", async () => {
    const p = createNullPersistence();
    await p.flush();
    expect(p.getState()).toEqual(INITIAL_PERSIST_STATE);
  });

  it("subscribe returns working unsubscribe", () => {
    const p = createNullPersistence();
    const unsub = p.subscribe(() => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });

  it("destroy does not throw", () => {
    const p = createNullPersistence();
    expect(() => p.destroy()).not.toThrow();
  });
});
