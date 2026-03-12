/**
 * Singleton persistence lifecycle manager.
 *
 * Owns the current PersistenceService instance and auto-subscribes to the
 * correct stores depending on the workspace phase. When the phase changes,
 * the old persistence is flushed + destroyed and a new one is created.
 *
 * Components call `getPersistence()` when they need to imperatively flush
 * (e.g. on session switch). The debounce/flush/beforeunload/dirty-tracking
 * lifecycle is managed here — not in components.
 */

import { Effect, Either } from "effect";
import {
  createPersistence,
  createNullPersistence,
  type PersistenceService,
} from "@/lib/persistence";
import { persistAnonymousWorkspaceFromSnapshot, captureAnonymousSnapshot } from "@/stores/anonymousWorkspaceStorage";
import { useCanvasStore } from "@/stores/canvasStore";
import { useAuthHandoffStore } from "@/stores/authHandoffStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { saveCanvasApi } from "@/services/sessionsClient";
import { persistenceMode, sessionIdOf, type PersistenceMode } from "@/lib/workspacePhase";
import type { CanvasState } from "@/lib/types";

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let current: PersistenceService = createNullPersistence();
let currentMode: PersistenceMode = "none";
let storeUnsubs: Array<() => void> = [];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return the active persistence instance. Safe to call anytime. */
export function getPersistence(): PersistenceService {
  return current;
}

/**
 * Swap the active persistence to match a new workspace mode.
 *
 * - Flushes the previous instance (fire-and-forget — keepalive handles API).
 * - Destroys the previous instance (timers, beforeunload, listeners).
 * - Creates a new instance for the given mode.
 * - Subscribes to the correct stores so `markDirty()` is called automatically.
 *
 * Call this from workspace store transitions or component effects.
 */
export function swapPersistence(
  mode: PersistenceMode,
  sessionId?: string,
): void {
  if (mode === currentMode && mode === "none") return;

  // --- tear down old ---
  const prev = current;
  teardownSubscriptions();
  void prev.flush().finally(() => prev.destroy());

  // --- create new ---
  currentMode = mode;

  if (mode === "local") {
    // Snapshot captured at markDirty time — mirrors the API-mode pattern.
    // The write closure uses the frozen snapshot, not live store state.
    let localSnapshot = captureAnonymousSnapshot();

    current = createPersistence(
      async () => {
        persistAnonymousWorkspaceFromSnapshot(localSnapshot);
      },
    );
    storeUnsubs = [
      useCanvasStore.subscribe(() => {
        localSnapshot = captureAnonymousSnapshot();
        current.markDirty();
      }),
      useAuthHandoffStore.subscribe(() => {
        localSnapshot = captureAnonymousSnapshot();
        current.markDirty();
      }),
    ];
  } else if (mode === "api" && sessionId) {
    // Snapshot captured at markDirty time — write uses the snapshot, not live
    // store state, so a session swap between markDirty and the deferred write
    // cannot cause cross-session data corruption (Finding #1).
    let snapshot: CanvasState = useCanvasStore.getState().getCanvasState();

    current = createPersistence(
      async () => {
        const result = await Effect.runPromise(
          Effect.either(saveCanvasApi(sessionId, snapshot)),
        );
        Either.match(result, {
          onLeft: (err) => {
            throw new Error(err.message);
          },
          onRight: () => {},
        });
      },
    );
    storeUnsubs = [
      useCanvasStore.subscribe(() => {
        snapshot = useCanvasStore.getState().getCanvasState();
        current.markDirty();
      }),
    ];
  } else {
    current = createNullPersistence();
  }
}

/**
 * Flush + destroy the current persistence and reset to null.
 * Call on unmount of the top-level workspace component.
 */
export function teardownPersistence(): void {
  teardownSubscriptions();
  const prev = current;
  current = createNullPersistence();
  currentMode = "none";
  void prev.flush().finally(() => prev.destroy());
}

// ---------------------------------------------------------------------------
// Bridge: workspaceStore → persistence
// ---------------------------------------------------------------------------

let bridgeUnsub: (() => void) | null = null;

/**
 * Subscribe to workspace store phase changes and auto-swap persistence.
 *
 * Call once from the top-level workspace component's mount effect, BEFORE
 * triggering any store transitions. Returns a cleanup function.
 */
export function initPersistenceBridge(): () => void {
  if (bridgeUnsub) bridgeUnsub();

  bridgeUnsub = useWorkspaceStore.subscribe((state, prevState) => {
    if (state.phase.phase === prevState.phase.phase) return;
    const mode = persistenceMode(state.phase);
    const sid = sessionIdOf(state.phase);
    swapPersistence(mode, sid);
  });

  return () => {
    if (bridgeUnsub) {
      bridgeUnsub();
      bridgeUnsub = null;
    }
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function teardownSubscriptions(): void {
  for (const unsub of storeUnsubs) unsub();
  storeUnsubs = [];
}
