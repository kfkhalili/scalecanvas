import { describe, it, expect } from "vitest";
import { Option } from "effect";
import { getGcpIconUrl, isGcpNodeType } from "./gcpNodeIcons";

describe("getGcpIconUrl", () => {
  it("returns some(/icons/gcp/) for known GCP types", () => {
    expect(Option.getOrNull(getGcpIconUrl("gcpCloudRun"))).toMatch(
      /^\/icons\/gcp\//
    );
    expect(Option.getOrNull(getGcpIconUrl("gcpCloudRun"))).toContain(".svg");
    expect(Option.getOrNull(getGcpIconUrl("gcpGke"))).toMatch(/^\/icons\/gcp\//);
    expect(Option.getOrNull(getGcpIconUrl("gcpPubSub"))).toMatch(
      /^\/icons\/gcp\//
    );
    expect(Option.getOrNull(getGcpIconUrl("gcpBigQuery"))).toMatch(
      /^\/icons\/gcp\//
    );
  });

  it("returns none for non-GCP types", () => {
    expect(Option.isNone(getGcpIconUrl("lambda"))).toBe(true);
    expect(Option.isNone(getGcpIconUrl("dynamodb"))).toBe(true);
    expect(Option.isNone(getGcpIconUrl("genericNosql"))).toBe(true);
    expect(Option.isNone(getGcpIconUrl("unknown"))).toBe(true);
    expect(Option.isNone(getGcpIconUrl(""))).toBe(true);
  });
});

describe("isGcpNodeType", () => {
  it("returns true for GCP types", () => {
    expect(isGcpNodeType("gcpCloudRun")).toBe(true);
    expect(isGcpNodeType("gcpPubSub")).toBe(true);
  });

  it("returns false for non-GCP types", () => {
    expect(isGcpNodeType("lambda")).toBe(false);
    expect(isGcpNodeType("text")).toBe(false);
  });
});
