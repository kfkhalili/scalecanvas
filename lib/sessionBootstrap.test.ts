import { describe, it, expect, vi } from "vitest";
import { ok, err } from "neverthrow";
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
    questionTitle: null,
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
  };
}

function mockDeps(overrides: Partial<BootstrapDeps> = {}): BootstrapDeps {
  return {
    createSession: vi.fn().mockResolvedValue(ok(mockSession("new-1"))),
    fetchSessions: vi.fn().mockResolvedValue(ok([])),
    deductTokenAndCreateSession: vi.fn().mockResolvedValue(ok("deducted-1")),
    renameSession: vi.fn().mockResolvedValue(undefined),
    setPendingAuthHandoff: vi.fn(),
    setHasAttemptedEval: vi.fn(),
    redirectTo: vi.fn(),
    ...overrides,
  };
}

describe("decideBootstrapAction", () => {
  it("returns redirect_login when no session", () => {
    expect(decideBootstrapAction(false, ctx()).type).toBe("redirect_login");
  });

  it("returns resume_or_idle when no anonymous chat", () => {
    expect(decideBootstrapAction(true, ctx()).type).toBe("resume_or_idle");
  });

  it("returns deduct_and_handoff when eval was attempted", () => {
    expect(
      decideBootstrapAction(
        true,
        ctx({ hasAnonymousChat: true, hasAttemptedEval: true })
      ).type
    ).toBe("deduct_and_handoff");
  });

  it("returns create_with_title_and_handoff when anonymous chat but no eval", () => {
    expect(
      decideBootstrapAction(
        true,
        ctx({ hasAnonymousChat: true })
      ).type
    ).toBe("create_with_title_and_handoff");
  });
});

describe("executeBootstrapAction", () => {
  it("redirect_login: redirects to /login", async () => {
    const deps = mockDeps();
    await executeBootstrapAction({ type: "redirect_login" }, ctx(), deps);
    expect(deps.redirectTo).toHaveBeenCalledWith("/login");
  });

  it("resume_or_idle: redirects to most recent session when sessions exist", async () => {
    const deps = mockDeps({
      fetchSessions: vi.fn().mockResolvedValue(ok([mockSession("s-recent")])),
    });
    await executeBootstrapAction({ type: "resume_or_idle" }, ctx(), deps);
    expect(deps.redirectTo).toHaveBeenCalledWith("/s-recent");
  });

  it("resume_or_idle: does nothing when no sessions exist", async () => {
    const deps = mockDeps({
      fetchSessions: vi.fn().mockResolvedValue(ok([])),
    });
    await executeBootstrapAction({ type: "resume_or_idle" }, ctx(), deps);
    expect(deps.redirectTo).not.toHaveBeenCalled();
  });

  it("resume_or_idle: does nothing on fetch error", async () => {
    const deps = mockDeps({
      fetchSessions: vi.fn().mockResolvedValue(err({ message: "fail" })),
    });
    await executeBootstrapAction({ type: "resume_or_idle" }, ctx(), deps);
    expect(deps.redirectTo).not.toHaveBeenCalled();
  });

  it("deduct_and_handoff: clears eval flag, deducts, renames, and hands off", async () => {
    const deps = mockDeps();
    const c = ctx({ hasAnonymousChat: true, hasAttemptedEval: true, questionTitle: "Design X" });
    await executeBootstrapAction({ type: "deduct_and_handoff" }, c, deps);
    expect(deps.setHasAttemptedEval).toHaveBeenCalledWith(false);
    expect(deps.renameSession).toHaveBeenCalledWith("deducted-1", "Design X");
    expect(deps.setPendingAuthHandoff).toHaveBeenCalledWith("deducted-1");
  });

  it("deduct_and_handoff: skips rename when no questionTitle", async () => {
    const deps = mockDeps();
    const c = ctx({ hasAnonymousChat: true, hasAttemptedEval: true, questionTitle: null });
    await executeBootstrapAction({ type: "deduct_and_handoff" }, c, deps);
    expect(deps.renameSession).not.toHaveBeenCalled();
    expect(deps.setPendingAuthHandoff).toHaveBeenCalledWith("deducted-1");
  });

  it("deduct_and_handoff: does nothing on deduction error", async () => {
    const deps = mockDeps({
      deductTokenAndCreateSession: vi.fn().mockResolvedValue(err({ message: "no tokens" })),
    });
    const c = ctx({ hasAnonymousChat: true, hasAttemptedEval: true });
    await executeBootstrapAction({ type: "deduct_and_handoff" }, c, deps);
    expect(deps.setHasAttemptedEval).toHaveBeenCalledWith(false);
    expect(deps.setPendingAuthHandoff).not.toHaveBeenCalled();
  });

  it("create_with_title_and_handoff: creates session with title and hands off", async () => {
    const deps = mockDeps();
    const c = ctx({ hasAnonymousChat: true, questionTitle: "Design Y" });
    await executeBootstrapAction({ type: "create_with_title_and_handoff" }, c, deps);
    expect(deps.createSession).toHaveBeenCalledWith("Design Y");
    expect(deps.setPendingAuthHandoff).toHaveBeenCalledWith("new-1");
  });

  it("create_with_title_and_handoff: does nothing on create error", async () => {
    const deps = mockDeps({
      createSession: vi.fn().mockResolvedValue(err({ message: "fail" })),
    });
    const c = ctx({ hasAnonymousChat: true });
    await executeBootstrapAction({ type: "create_with_title_and_handoff" }, c, deps);
    expect(deps.setPendingAuthHandoff).not.toHaveBeenCalled();
  });
});
