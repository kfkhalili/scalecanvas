import { describe, it, expect } from "vitest";
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
    const expected = getAwsIconUrl(type);
    expect(getNodeIconUrl(type)).toBe(expected);
    expect(getNodeIconUrl("awsS3")).toBe(getAwsIconUrl("awsS3"));
  });

  it("returns same URL as getGcpIconUrl for gcp types", () => {
    const type = "gcpGke";
    expect(getNodeIconUrl(type)).toBe(getGcpIconUrl(type));
    expect(getNodeIconUrl("gcpCloudRun")).toBe(getGcpIconUrl("gcpCloudRun"));
  });

  it("returns null for generic types (no URL, use component)", () => {
    expect(getNodeIconUrl("genericNosql")).toBeNull();
    expect(getNodeIconUrl("genericApi")).toBeNull();
  });

  it("returns same path as getAzureIconUrl for azure types", () => {
    expect(getNodeIconUrl("azureFunctions")).toBe(getAzureIconUrl("azureFunctions"));
    expect(getNodeIconUrl("azureCosmosDb")).toBe(getAzureIconUrl("azureCosmosDb"));
  });

  it("returns null for unknown types", () => {
    expect(getNodeIconUrl("unknown")).toBeNull();
    expect(getNodeIconUrl("")).toBeNull();
  });
});

describe("getNodeIconComponent", () => {
  it("returns same component as getGenericIcon for generic types", () => {
    expect(getNodeIconComponent("genericNosql")).toBe(getGenericIcon("genericNosql"));
    expect(getNodeIconComponent("genericApi")).toBe(getGenericIcon("genericApi"));
  });

  it("returns null for aws/gcp types (use URL instead)", () => {
    expect(getNodeIconComponent("awsLambda")).toBeNull();
    expect(getNodeIconComponent("gcpGke")).toBeNull();
  });

  it("returns null for unknown types", () => {
    expect(getNodeIconComponent("unknown")).toBeNull();
    expect(getNodeIconComponent("")).toBeNull();
  });
});
