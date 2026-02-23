import { describe, it, expect } from "vitest";
import { getGcpIconUrl, isGcpNodeType } from "./gcpNodeIcons";

describe("getGcpIconUrl", () => {
  it("returns /icons/gcp/ path for known GCP types", () => {
    expect(getGcpIconUrl("gcpCloudRun")).toMatch(/^\/icons\/gcp\//);
    expect(getGcpIconUrl("gcpCloudRun")).toContain(".svg");
    expect(getGcpIconUrl("gcpGke")).toMatch(/^\/icons\/gcp\//);
    expect(getGcpIconUrl("gcpPubSub")).toMatch(/^\/icons\/gcp\//);
    expect(getGcpIconUrl("gcpBigQuery")).toMatch(/^\/icons\/gcp\//);
  });

  it("returns null for non-GCP types", () => {
    expect(getGcpIconUrl("lambda")).toBeNull();
    expect(getGcpIconUrl("dynamodb")).toBeNull();
    expect(getGcpIconUrl("genericNosql")).toBeNull();
    expect(getGcpIconUrl("unknown")).toBeNull();
    expect(getGcpIconUrl("")).toBeNull();
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
