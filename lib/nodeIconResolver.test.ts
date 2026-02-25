import { describe, it, expect } from "vitest";
import { Option } from "effect";
import {
  getNodeIconUrl,
  getNodeIconComponent,
} from "./nodeIconResolver";
import { getAwsIconUrl } from "./awsNodeIcons";
import { getAzureIconUrl } from "./azureNodeIcons";
import { getGcpIconUrl } from "./gcpNodeIcons";
import { getGenericIcon } from "./genericNodeIcons";

describe("getNodeIconUrl", () => {
  it("returns same URL as getAwsIconUrl for aws types", () => {
    const type = "awsLambda";
    expect(Option.getOrNull(getNodeIconUrl(type))).toBe(
      Option.getOrNull(getAwsIconUrl(type))
    );
    expect(Option.getOrNull(getNodeIconUrl("awsS3"))).toBe(
      Option.getOrNull(getAwsIconUrl("awsS3"))
    );
  });

  it("returns same URL as getGcpIconUrl for gcp types", () => {
    const type = "gcpGke";
    expect(Option.getOrNull(getNodeIconUrl(type))).toBe(
      Option.getOrNull(getGcpIconUrl(type))
    );
    expect(Option.getOrNull(getNodeIconUrl("gcpCloudRun"))).toBe(
      Option.getOrNull(getGcpIconUrl("gcpCloudRun"))
    );
  });

  it("returns none for generic types (no URL, use component)", () => {
    expect(Option.isNone(getNodeIconUrl("genericNosql"))).toBe(true);
    expect(Option.isNone(getNodeIconUrl("genericApi"))).toBe(true);
  });

  it("returns same path as getAzureIconUrl for azure types", () => {
    expect(Option.getOrNull(getNodeIconUrl("azureFunctions"))).toBe(
      Option.getOrNull(getAzureIconUrl("azureFunctions"))
    );
    expect(Option.getOrNull(getNodeIconUrl("azureCosmosDb"))).toBe(
      Option.getOrNull(getAzureIconUrl("azureCosmosDb"))
    );
  });

  it("returns none for unknown types", () => {
    expect(Option.isNone(getNodeIconUrl("unknown"))).toBe(true);
    expect(Option.isNone(getNodeIconUrl(""))).toBe(true);
  });
});

describe("getNodeIconComponent", () => {
  it("returns same component as getGenericIcon for generic types", () => {
    expect(Option.getOrNull(getNodeIconComponent("genericNosql"))).toBe(
      Option.getOrNull(getGenericIcon("genericNosql"))
    );
    expect(Option.getOrNull(getNodeIconComponent("genericApi"))).toBe(
      Option.getOrNull(getGenericIcon("genericApi"))
    );
  });

  it("returns none for aws/gcp types (use URL instead)", () => {
    expect(Option.isNone(getNodeIconComponent("awsLambda"))).toBe(true);
    expect(Option.isNone(getNodeIconComponent("gcpGke"))).toBe(true);
  });

  it("returns none for unknown types", () => {
    expect(Option.isNone(getNodeIconComponent("unknown"))).toBe(true);
    expect(Option.isNone(getNodeIconComponent(""))).toBe(true);
  });
});
