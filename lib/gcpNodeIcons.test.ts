import { describe, it, expect } from "vitest";
import { Option } from "effect";
import { getGcpIconUrl, isGcpNodeType } from "./gcpNodeIcons";

describe("getGcpIconUrl", () => {
  it("returns some(unpkg gcp-icons URL) for known GCP types", () => {
    const url = Option.getOrNull(getGcpIconUrl("gcpCloudRun"));
    expect(url).toMatch(/^https:\/\/unpkg\.com\/gcp-icons@1\.0\.4\/dist\/icons\//);
    expect(url).toContain(".svg");
    expect(Option.getOrNull(getGcpIconUrl("gcpGke"))).toContain("gke-512-color.svg");
    expect(Option.getOrNull(getGcpIconUrl("gcpPubSub"))).toContain("integrationservices-512-color.svg");
    expect(Option.getOrNull(getGcpIconUrl("gcpBigQuery"))).toContain("bigquery-512-color.svg");
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
