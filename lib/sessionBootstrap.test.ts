import { Effect, Option } from "effect";
import { describe, it, expect, vi } from "vitest";
import {
  decideBootstrapAction,
  executeBootstrapAction,
  type BootstrapContext,
  type BootstrapDeps,
} from "./sessionBootstrap";
import type { Session } from "@/lib/types";

function ctx(overrides: Partial<BootstrapContext> = {}): BootstrapContext {
  return {
    hasAnonymousChat: false,
    hasAttemptedEval: false,
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
    ...overrides,
  };
}

describe("decideBootstrapAction", () => {
  it("returns redirect_login when no session", () => {
    expect(decideBootstrapAction(false).type).toBe("redirect_login");
  });

  it("returns resume_or_idle when session exists (with or without anonymous chat)", () => {
    expect(decideBootstrapAction(true).type).toBe("resume_or_idle");
    expect(
      decideBootstrapAction(true).type
    ).toBe("resume_or_idle");
    expect(
      decideBootstrapAction(true).type
    ).toBe("resume_or_idle");
  });
});

describe("executeBootstrapAction", () => {
  it("redirect_login: redirects to /", async () => {
    const deps = mockDeps();
    await executeBootstrapAction({ type: "redirect_login" }, ctx(), deps);
    expect(deps.redirectTo).toHaveBeenCalledWith("/");
  });

  it("resume_or_idle: redirects to most recent session when sessions exist", async () => {
    const deps = mockDeps({
      fetchSessions: vi.fn().mockReturnValue(Effect.succeed([mockSession("s-recent")])),
    });
    await executeBootstrapAction({ type: "resume_or_idle" }, ctx(), deps);
    expect(deps.redirectTo).toHaveBeenCalledWith("/s-recent");
  });

  it("resume_or_idle: does nothing when no sessions exist", async () => {
    const deps = mockDeps({
      fetchSessions: vi.fn().mockReturnValue(Effect.succeed([])),
    });
    await executeBootstrapAction({ type: "resume_or_idle" }, ctx(), deps);
    expect(deps.redirectTo).not.toHaveBeenCalled();
  });

  it("resume_or_idle: does nothing on fetch error", async () => {
    const deps = mockDeps({
      fetchSessions: vi.fn().mockReturnValue(Effect.fail({ message: "fail" })),
    });
    await executeBootstrapAction({ type: "resume_or_idle" }, ctx(), deps);
    expect(deps.redirectTo).not.toHaveBeenCalled();
  });
});
