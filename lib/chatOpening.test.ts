import { Option } from "effect";
import { describe, it, expect } from "vitest";
import { shouldTriggerOpening } from "./chatOpening";

describe("shouldTriggerOpening", () => {
  const sessionId = "550e8400-e29b-41d4-a716-446655440000";

  it("returns true for new token session: has sessionId, empty transcript, not anonymous, not trial, not yet requested", () => {
    expect(
      shouldTriggerOpening({
        sessionId,
        initialEntriesLength: 0,
        isAnonymous: false,
        isTrial: false,
        openingRequestedSessionIdOpt: Option.none(),
      })
    ).toBe(true);
  });

  it("returns false for trial session with empty transcript (do not send opening; design from first message)", () => {
    expect(
      shouldTriggerOpening({
        sessionId,
        initialEntriesLength: 0,
        isAnonymous: false,
        isTrial: true,
        openingRequestedSessionIdOpt: Option.none(),
      })
    ).toBe(false);
  });

  it("returns false for trial session with existing transcript (handoff)", () => {
    expect(
      shouldTriggerOpening({
        sessionId,
        initialEntriesLength: 2,
        isAnonymous: false,
        isTrial: true,
        openingRequestedSessionIdOpt: Option.none(),
      })
    ).toBe(false);
  });

  it("returns false when opening already requested for this session", () => {
    expect(
      shouldTriggerOpening({
        sessionId,
        initialEntriesLength: 0,
        isAnonymous: false,
        isTrial: false,
        openingRequestedSessionIdOpt: Option.some(sessionId),
      })
    ).toBe(false);
  });

  it("returns false when anonymous (opening is comprehensive prompt only, no Bedrock)", () => {
    expect(
      shouldTriggerOpening({
        sessionId: undefined,
        initialEntriesLength: 0,
        isAnonymous: true,
        isTrial: false,
        openingRequestedSessionIdOpt: Option.none(),
      })
    ).toBe(false);
  });

  it("returns false when no sessionId", () => {
    expect(
      shouldTriggerOpening({
        sessionId: undefined,
        initialEntriesLength: 0,
        isAnonymous: false,
        isTrial: false,
        openingRequestedSessionIdOpt: Option.none(),
      })
    ).toBe(false);
  });

  it("returns false when initialEntries not empty (e.g. fetched transcript)", () => {
    expect(
      shouldTriggerOpening({
        sessionId,
        initialEntriesLength: 1,
        isAnonymous: false,
        isTrial: false,
        openingRequestedSessionIdOpt: Option.none(),
      })
    ).toBe(false);
  });
});
