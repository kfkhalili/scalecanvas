import { describe, it, expect } from "vitest";
import { getCanvasReviewScheduleDecision } from "./useCanvasReview";

describe("getCanvasReviewScheduleDecision", () => {
  it("does not schedule on first run (lastScheduled null), records snapshot", () => {
    const snapshot = '{"nodes":[],"edges":[]}';
    const result = getCanvasReviewScheduleDecision(snapshot, null);
    expect(result.schedule).toBe(false);
    expect(result.nextLastScheduled).toBe(snapshot);
  });

  it("does not schedule when canvas unchanged (same snapshot)", () => {
    const snapshot = '{"nodes":[{"id":"a"}],"edges":[]}';
    const result = getCanvasReviewScheduleDecision(snapshot, snapshot);
    expect(result.schedule).toBe(false);
    expect(result.nextLastScheduled).toBe(snapshot);
  });

  it("schedules when canvas changed (different snapshot)", () => {
    const previous = '{"nodes":[{"id":"a"}],"edges":[]}';
    const current = '{"nodes":[{"id":"a"},{"id":"b"}],"edges":[]}';
    const result = getCanvasReviewScheduleDecision(current, previous);
    expect(result.schedule).toBe(true);
    expect(result.nextLastScheduled).toBe(current);
  });

  it("schedules when only edges changed", () => {
    const previous = '{"nodes":[],"edges":[]}';
    const current = '{"nodes":[],"edges":[{"id":"e1","source":"a","target":"b"}]}';
    const result = getCanvasReviewScheduleDecision(current, previous);
    expect(result.schedule).toBe(true);
    expect(result.nextLastScheduled).toBe(current);
  });
});
