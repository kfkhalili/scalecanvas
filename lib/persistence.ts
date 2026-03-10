/**
 * Unified persistence layer.
 *
 * Provides debounced writes, flush-on-demand, dirty tracking, error surfacing,
 * and subscriber notifications. Replaces the two divergent codepaths:
 *
 * - Anonymous: debounced localStorage in InterviewSplitView (500ms, has flush)
 * - Authenticated: debounced API in FlowCanvas (800ms, NO flush — data loss bug)
 *
 * Callers supply a `write` function that performs the actual I/O:
 *
 *   // localStorage
 *   createPersistence(async () => {
 *     localStorage.setItem(key, JSON.stringify(getData()));
 *   });
 *
 *   // API
 *   createPersistence(async () => {
 *     const result = await Effect.runPromise(Effect.either(saveCanvasApi(sid, getData())));
 *     Either.match(result, {
 *       onLeft: (err) => { throw new Error(err.message); },
 *       onRight: () => {},
 *     });
 *   });
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PersistState = {
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
};

export type PersistenceService = {
  /** Signal that data has changed. Schedules a debounced write. */
  markDirty(): void;
  /** Flush any pending save immediately. Awaits in-flight writes. */
  flush(): Promise<void>;
  /** Current persistence state snapshot. */
  getState(): PersistState;
  /** Subscribe to state changes. Returns unsubscribe function. */
  subscribe(listener: (state: PersistState) => void): () => void;
  /** Tear down timers and clear listeners. Does NOT flush. */
  destroy(): void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const INITIAL_PERSIST_STATE: PersistState = {
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  error: null,
};

export const DEFAULT_DEBOUNCE_MS = 500;

// ---------------------------------------------------------------------------
// Core factory
// ---------------------------------------------------------------------------

export function createPersistence(
  write: () => Promise<void>,
  options?: {
    readonly debounceMs?: number;
    /** Register a beforeunload listener that auto-flushes. Default: true. */
    readonly flushOnUnload?: boolean;
  },
): PersistenceService {
  const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const flushOnUnload = options?.flushOnUnload ?? true;
  let state: PersistState = { ...INITIAL_PERSIST_STATE };
  const listeners = new Set<(s: PersistState) => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;
  let inflightWrite: Promise<void> | null = null;

  const onBeforeUnload = (): void => {
    void svc.flush();
  };
  if (flushOnUnload && typeof window !== "undefined") {
    window.addEventListener("beforeunload", onBeforeUnload);
  }

  function emit(update: Partial<PersistState>): void {
    state = { ...state, ...update };
    for (const fn of listeners) fn(state);
  }

  function cancelTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function writeNow(): Promise<void> {
    const gen = generation;
    emit({ isSaving: true });
    const p = write();
    inflightWrite = p;
    try {
      await p;
      emit({
        isDirty: generation !== gen,
        isSaving: false,
        lastSavedAt: Date.now(),
        error: null,
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Persistence write failed";
      emit({ isSaving: false, error: message });
    } finally {
      if (inflightWrite === p) inflightWrite = null;
    }
  }

  const svc: PersistenceService = {
    markDirty(): void {
      generation++;
      emit({ isDirty: true });
      cancelTimer();
      timer = setTimeout(() => {
        timer = null;
        void writeNow();
      }, debounceMs);
    },

    async flush(): Promise<void> {
      cancelTimer();
      if (inflightWrite !== null) {
        await inflightWrite;
      }
      if (state.isDirty) {
        await writeNow();
      }
    },

    getState(): PersistState {
      return state;
    },

    subscribe(listener: (state: PersistState) => void): () => void {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },

    destroy(): void {
      cancelTimer();
      listeners.clear();
      if (flushOnUnload && typeof window !== "undefined") {
        window.removeEventListener("beforeunload", onBeforeUnload);
      }
    },
  };

  return svc;
}

// ---------------------------------------------------------------------------
// Null implementation (for non-persisting phases)
// ---------------------------------------------------------------------------

export function createNullPersistence(): PersistenceService {
  return {
    markDirty(): void {},
    async flush(): Promise<void> {},
    getState(): PersistState {
      return INITIAL_PERSIST_STATE;
    },
    subscribe(): () => void {
      return (): void => {};
    },
    destroy(): void {},
  };
}
