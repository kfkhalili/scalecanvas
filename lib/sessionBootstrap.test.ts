import { Effect, Option } from "effect";
import { describe, it, expect, vi } from "vitest";
import {
  decideBootstrapAction,
  executeBootstrapAction,
  type BootstrapContext,
  type BootstrapDeps,
  type HandoffResult,
} from "./sessionBootstrap";
import type { Session } from "@/lib/types";

function ctx(overrides: Partial<BootstrapContext> = {}): BootstrapContext {
  return {
    hasAnonymousChat: false,
    questionTitle: Option.none(),
    ...overrides,
  };
}

function mockSession(id: string): Session {
  return {
    id,
    userId: "u1",
    title: null,
    status: "active",
    isTrial: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    conclusionSummary: null,
  };
}

function mockDeps(overrides: Partial<BootstrapDeps> = {}): BootstrapDeps {
  return {
    fetchSessions: vi.fn().mockReturnValue(Effect.succeed([])),
    redirectTo: vi.fn(),
    doHandoff: vi.fn().mockReturnValue(
      Effect.succeed<HandoffResult>({ created: false })
    ),
    setPendingAuthHandoff: vi.fn(),
    clearAnonymousState: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// decideBootstrapAction
// ---------------------------------------------------------------------------

describe("decideBootstrapAction", () => {
  it("returns redirect_login when hasSession is false regardless of anonymous chat", () => {
    expect(decideBootstrapAction(false, false).type).toBe("redirect_login");
    expect(decideBootstrapAction(false, true).type).toBe("redirect_login");
  });

  it("returns handoff when user has a session and has anonymous chat", () => {
    expect(decideBootstrapAction(true, true).type).toBe("handoff");
  });

  it("returns resume_or_idle when user has a session and no anonymous chat", () => {
    expect(decideBootstrapAction(true, false).type).toBe("resume_or_idle");
  });
});

// ---------------------------------------------------------------------------
// executeBootstrapAction — redirect_login
// ---------------------------------------------------------------------------

describe("executeBootstrapAction: redirect_login", () => {
  it("redirects to /", async () => {
    const deps = mockDeps();
    await executeBootstrapAction({ type: "redirect_login" }, ctx(), deps);
    expect(deps.redirectTo).toHaveBeenCalledWith("/");
  });
});

// ---------------------------------------------------------------------------
// executeBootstrapAction — resume_or_idle
// ---------------------------------------------------------------------------

describe("executeBootstrapAction: resume_or_idle", () => {
  it("redirects to most recent session when sessions exist", async () => {
    const deps = mockDeps({
      fetchSessions: vi.fn().mockReturnValue(
        Effect.succeed([mockSession("s-recent")])
      ),
    });
    await executeBootstrapAction({ type: "resume_or_idle" }, ctx(), deps);
    expect(deps.redirectTo).toHaveBeenCalledWith("/s-recent");
  });

  it("does not redirect when no sessions exist", async () => {
    const deps = mockDeps();
    await executeBootstrapAction({ type: "resume_or_idle" }, ctx(), deps);
    expect(deps.redirectTo).not.toHaveBeenCalled();
  });

  it("does not redirect on fetch error", async () => {
    const deps = mockDeps({
      fetchSessions: vi.fn().mockReturnValue(Effect.fail({ message: "fail" })),
    });
    await executeBootstrapAction({ type: "resume_or_idle" }, ctx(), deps);
    expect(deps.redirectTo).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// executeBootstrapAction — handoff
// ---------------------------------------------------------------------------

describe("executeBootstrapAction: handoff", () => {
  it("sets pending handoff and redirects to new session when created is true", async () => {
    const deps = mockDeps({
      doHandoff: vi.fn().mockReturnValue(
        Effect.succeed<HandoffResult>({ created: true, session_id: "s-new" })
      ),
    });
    await executeBootstrapAction(
      { type: "handoff" },
      ctx({ hasAnonymousChat: true }),
      deps
    );
    expect(deps.setPendingAuthHandoff).toHaveBeenCalledWith("s-new");
    expect(deps.redirectTo).toHaveBeenCalledWith("/s-new");
    expect(deps.clearAnonymousState).not.toHaveBeenCalled();
  });

  it("clears anonymous state and redirects to most recent session when created is false", async () => {
    const deps = mockDeps({
      doHandoff: vi.fn().mockReturnValue(
        Effect.succeed<HandoffResult>({ created: false })
      ),
      fetchSessions: vi.fn().mockReturnValue(
        Effect.succeed([mockSession("s-existing")])
      ),
    });
    await executeBootstrapAction(
      { type: "handoff" },
      ctx({ hasAnonymousChat: true }),
      deps
    );
    expect(deps.clearAnonymousState).toHaveBeenCalled();
    expect(deps.setPendingAuthHandoff).not.toHaveBeenCalled();
    expect(deps.redirectTo).toHaveBeenCalledWith("/s-existing");
  });

  it("calls notifyTrialAlreadyClaimed when created is false", async () => {
    const notifyTrialAlreadyClaimed = vi.fn();
    const deps = mockDeps({
      doHandoff: vi.fn().mockReturnValue(
        Effect.succeed<HandoffResult>({ created: false })
      ),
      notifyTrialAlreadyClaimed,
    });
    await executeBootstrapAction(
      { type: "handoff" },
      ctx({ hasAnonymousChat: true }),
      deps
    );
    expect(notifyTrialAlreadyClaimed).toHaveBeenCalledOnce();
  });

  it("does not throw when notifyTrialAlreadyClaimed is omitted", async () => {
    const deps = mockDeps({
      doHandoff: vi.fn().mockReturnValue(
        Effect.succeed<HandoffResult>({ created: false })
      ),
    });
    await expect(
      executeBootstrapAction({ type: "handoff" }, ctx({ hasAnonymousChat: true }), deps)
    ).resolves.toBeUndefined();
  });

  it("clears anonymous state and redirects to most recent session when handoff fails", async () => {
    const deps = mockDeps({
      doHandoff: vi.fn().mockReturnValue(Effect.fail({ message: "network error" })),
      fetchSessions: vi.fn().mockReturnValue(
        Effect.succeed([mockSession("s-fallback")])
      ),
    });
    await executeBootstrapAction(
      { type: "handoff" },
      ctx({ hasAnonymousChat: true }),
      deps
    );
    expect(deps.clearAnonymousState).toHaveBeenCalled();
    expect(deps.redirectTo).toHaveBeenCalledWith("/s-fallback");
  });

  it("passes questionTitle from context to doHandoff", async () => {
    const deps = mockDeps();
    const qt = Option.some("System Design: URL Shortener");
    await executeBootstrapAction(
      { type: "handoff" },
      ctx({ hasAnonymousChat: true, questionTitle: qt }),
      deps
    );
    expect(deps.doHandoff).toHaveBeenCalledWith(qt);
  });
});

