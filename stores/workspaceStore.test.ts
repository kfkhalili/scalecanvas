import { describe, it, expect, beforeEach } from "vitest";
import { useWorkspaceStore, getSessionSignal } from "./workspaceStore";

const SID_A = "00000000-0000-0000-0000-00000000000a";
const SID_B = "00000000-0000-0000-0000-00000000000b";

beforeEach(() => {
  useWorkspaceStore.getState().reset();
});

describe("workspaceStore", () => {
  it("starts in boot phase", () => {
    expect(useWorkspaceStore.getState().phase).toEqual({ phase: "boot" });
  });

  // ── boot exits ──────────────────────────────────────────────────────
  it("enterAnonymous: boot → anonymous", () => {
    useWorkspaceStore.getState().enterAnonymous();
    expect(useWorkspaceStore.getState().phase).toEqual({ phase: "anonymous" });
  });

  it("enterBootstrapping: boot → bootstrapping", () => {
    useWorkspaceStore.getState().enterBootstrapping();
    expect(useWorkspaceStore.getState().phase).toEqual({ phase: "bootstrapping" });
  });

  it("loadSession from boot: boot → loading-session", () => {
    useWorkspaceStore.getState().loadSession(SID_A);
    expect(useWorkspaceStore.getState().phase).toEqual({
      phase: "loading-session",
      sessionId: SID_A,
    });
  });

  // ── bootstrapping exits ─────────────────────────────────────────────
  it("loadSession from bootstrapping: bootstrapping → loading-session", () => {
    useWorkspaceStore.getState().enterBootstrapping();
    useWorkspaceStore.getState().loadSession(SID_A);
    expect(useWorkspaceStore.getState().phase).toEqual({
      phase: "loading-session",
      sessionId: SID_A,
    });
  });

  // ── loading-session exits ───────────────────────────────────────────
  it("activateSession: loading-session → active (carries sessionId)", () => {
    useWorkspaceStore.getState().loadSession(SID_A);
    useWorkspaceStore.getState().activateSession();
    expect(useWorkspaceStore.getState().phase).toEqual({
      phase: "active",
      sessionId: SID_A,
    });
  });

  it("deactivateSession: loading-session → inactive (carries sessionId)", () => {
    useWorkspaceStore.getState().loadSession(SID_A);
    useWorkspaceStore.getState().deactivateSession();
    expect(useWorkspaceStore.getState().phase).toEqual({
      phase: "inactive",
      sessionId: SID_A,
    });
  });

  it("activateSession throws from anonymous phase", () => {
    useWorkspaceStore.getState().enterAnonymous();
    expect(() => useWorkspaceStore.getState().activateSession()).toThrow(
      "Invalid workspace transition: anonymous → active",
    );
  });

  // ── active exits ────────────────────────────────────────────────────
  it("loadSession from active: active → loading-session (session switch)", () => {
    useWorkspaceStore.getState().loadSession(SID_A);
    useWorkspaceStore.getState().activateSession();
    useWorkspaceStore.getState().loadSession(SID_B);
    expect(useWorkspaceStore.getState().phase).toEqual({
      phase: "loading-session",
      sessionId: SID_B,
    });
  });

  it("deactivateSession from active: active → inactive (interview ends)", () => {
    useWorkspaceStore.getState().loadSession(SID_A);
    useWorkspaceStore.getState().activateSession();
    useWorkspaceStore.getState().deactivateSession();
    expect(useWorkspaceStore.getState().phase).toEqual({
      phase: "inactive",
      sessionId: SID_A,
    });
  });

  it("deactivateSession throws from anonymous phase", () => {
    useWorkspaceStore.getState().enterAnonymous();
    expect(() => useWorkspaceStore.getState().deactivateSession()).toThrow(
      "Invalid workspace transition: anonymous → inactive",
    );
  });

  // ── illegal transitions throw ───────────────────────────────────────
  it("enterAnonymous throws from active phase", () => {
    useWorkspaceStore.getState().loadSession(SID_A);
    useWorkspaceStore.getState().activateSession();
    expect(() => useWorkspaceStore.getState().enterAnonymous()).toThrow(
      "Invalid workspace transition: active → anonymous",
    );
  });

  it("loadSession throws from anonymous phase", () => {
    useWorkspaceStore.getState().enterAnonymous();
    expect(() => useWorkspaceStore.getState().loadSession(SID_A)).toThrow(
      "Invalid workspace transition: anonymous → loading-session",
    );
  });

  it("enterBootstrapping throws from loading-session phase", () => {
    useWorkspaceStore.getState().loadSession(SID_A);
    expect(() => useWorkspaceStore.getState().enterBootstrapping()).toThrow(
      "Invalid workspace transition: loading-session → bootstrapping",
    );
  });

  // ── inactive exits ──────────────────────────────────────────────────
  it("activateSession from inactive: inactive → active (user claims trial or token)", () => {
    useWorkspaceStore.getState().loadSession(SID_A);
    useWorkspaceStore.getState().deactivateSession();
    useWorkspaceStore.getState().activateSession();
    expect(useWorkspaceStore.getState().phase).toEqual({
      phase: "active",
      sessionId: SID_A,
    });
  });

  it("loadSession from inactive: inactive → loading-session (switch session)", () => {
    useWorkspaceStore.getState().loadSession(SID_A);
    useWorkspaceStore.getState().deactivateSession();
    useWorkspaceStore.getState().loadSession(SID_B);
    expect(useWorkspaceStore.getState().phase).toEqual({
      phase: "loading-session",
      sessionId: SID_B,
    });
  });

  // ── full journeys ───────────────────────────────────────────────────
  it("anonymous page load journey: boot → anonymous", () => {
    useWorkspaceStore.getState().enterAnonymous();
    expect(useWorkspaceStore.getState().phase.phase).toBe("anonymous");
  });

  it("bootstrapping + handoff journey: boot → bootstrapping → loading → active", () => {
    const s = useWorkspaceStore.getState;
    s().enterBootstrapping();
    s().loadSession(SID_A);
    s().activateSession();
    expect(s().phase).toEqual({ phase: "active", sessionId: SID_A });
  });

  it("direct session page load journey: boot → loading → active", () => {
    const s = useWorkspaceStore.getState;
    s().loadSession(SID_A);
    s().activateSession();
    expect(s().phase).toEqual({ phase: "active", sessionId: SID_A });
  });

  it("session switch + deactivate journey", () => {
    const s = useWorkspaceStore.getState;
    s().loadSession(SID_A);
    s().activateSession();
    // switch to B
    s().loadSession(SID_B);
    s().activateSession();
    // deactivate B
    s().deactivateSession();
    expect(s().phase).toEqual({ phase: "inactive", sessionId: SID_B });
    // switch back to A
    s().loadSession(SID_A);
    s().activateSession();
    expect(s().phase).toEqual({ phase: "active", sessionId: SID_A });
  });

  it("inactive reactivation journey: load → inactive → active", () => {
    const s = useWorkspaceStore.getState;
    s().loadSession(SID_A);
    s().deactivateSession();
    expect(s().phase).toEqual({ phase: "inactive", sessionId: SID_A });
    s().activateSession();
    expect(s().phase).toEqual({ phase: "active", sessionId: SID_A });
  });

  // ── reset ───────────────────────────────────────────────────────────
  it("reset returns to boot from any phase", () => {
    const s = useWorkspaceStore.getState;
    s().loadSession(SID_A);
    s().activateSession();
    expect(s().phase.phase).toBe("active");
    s().reset();
    expect(s().phase).toEqual({ phase: "boot" });
  });

  it("reset enables fresh lifecycle after anonymous", () => {
    const s = useWorkspaceStore.getState;
    s().enterAnonymous();
    s().reset();
    s().loadSession(SID_A);
    expect(s().phase).toEqual({ phase: "loading-session", sessionId: SID_A });
  });

  // ── session-scoped AbortController ──────────────────────────────────
  describe("session-scoped AbortController", () => {
    it("getSessionSignal returns undefined before any loadSession", () => {
      expect(getSessionSignal()).toBeUndefined();
    });

    it("loadSession creates a new signal", () => {
      useWorkspaceStore.getState().loadSession(SID_A);
      const signal = getSessionSignal();
      expect(signal).toBeDefined();
      expect(signal!.aborted).toBe(false);
    });

    it("loadSession aborts the previous session signal", () => {
      useWorkspaceStore.getState().loadSession(SID_A);
      const signalA = getSessionSignal()!;
      useWorkspaceStore.getState().activateSession();
      useWorkspaceStore.getState().loadSession(SID_B);
      expect(signalA.aborted).toBe(true);
      const signalB = getSessionSignal()!;
      expect(signalB.aborted).toBe(false);
      expect(signalB).not.toBe(signalA);
    });

    it("reset aborts the session signal", () => {
      useWorkspaceStore.getState().loadSession(SID_A);
      const signal = getSessionSignal()!;
      useWorkspaceStore.getState().reset();
      expect(signal.aborted).toBe(true);
      expect(getSessionSignal()).toBeUndefined();
    });

    it("deactivateSession does not abort the session signal", () => {
      useWorkspaceStore.getState().loadSession(SID_A);
      const signal = getSessionSignal()!;
      useWorkspaceStore.getState().deactivateSession();
      expect(signal.aborted).toBe(false);
    });

    it("signal chaining: load A → B → C aborts A and B, C remains active", () => {
      useWorkspaceStore.getState().loadSession(SID_A);
      const signalA = getSessionSignal()!;

      useWorkspaceStore.getState().activateSession();
      useWorkspaceStore.getState().loadSession(SID_B);
      const signalB = getSessionSignal()!;

      useWorkspaceStore.getState().activateSession();
      useWorkspaceStore.getState().loadSession("00000000-0000-0000-0000-00000000000c");
      const signalC = getSessionSignal()!;

      expect(signalA.aborted).toBe(true);
      expect(signalB.aborted).toBe(true);
      expect(signalC.aborted).toBe(false);
      // All signals are distinct
      expect(signalA).not.toBe(signalB);
      expect(signalB).not.toBe(signalC);
    });

    it("reset after load → load creates fresh signal space", () => {
      useWorkspaceStore.getState().loadSession(SID_A);
      const signalA = getSessionSignal()!;
      useWorkspaceStore.getState().reset();
      expect(signalA.aborted).toBe(true);
      expect(getSessionSignal()).toBeUndefined();

      // After reset, new loadSession creates a fresh signal
      useWorkspaceStore.getState().loadSession(SID_B);
      const signalB = getSessionSignal()!;
      expect(signalB.aborted).toBe(false);
      expect(signalB).not.toBe(signalA);
    });
  });
});
