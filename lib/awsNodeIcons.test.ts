import { describe, it, expect } from "vitest";
import { getAwsIconUrl } from "./awsNodeIcons";

describe("getAwsIconUrl", () => {
  it("returns unpkg URL for known types (awsPrefixSmallName)", () => {
    expect(getAwsIconUrl("awsLambda")).toContain("unpkg.com");
    expect(getAwsIconUrl("awsLambda")).toContain("AWSLambda.svg");
    expect(getAwsIconUrl("awsS3")).toContain("AmazonSimpleStorageService.svg");
    expect(getAwsIconUrl("awsDynamodb")).toContain("AmazonDynamoDB.svg");
    expect(getAwsIconUrl("awsRedis")).toContain("AmazonElastiCache.svg");
    expect(getAwsIconUrl("awsVpc")).toContain("AmazonVirtualPrivateCloud.svg");
  });

  it("returns null for unknown type", () => {
    expect(getAwsIconUrl("unknown")).toBeNull();
    expect(getAwsIconUrl("")).toBeNull();
  });

  it("uses architecture-service path", () => {
    const url = getAwsIconUrl("awsEc2");
    expect(url).toContain("architecture-service");
    expect(url).toContain("AmazonEC2.svg");
  });
});
