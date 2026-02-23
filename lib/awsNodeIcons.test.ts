import { describe, it, expect } from "vitest";
import { getAwsIconUrl } from "./awsNodeIcons";

describe("getAwsIconUrl", () => {
  it("returns unpkg URL for known types", () => {
    expect(getAwsIconUrl("lambda")).toContain("unpkg.com");
    expect(getAwsIconUrl("lambda")).toContain("AWSLambda.svg");
    expect(getAwsIconUrl("s3")).toContain("AmazonSimpleStorageService.svg");
    expect(getAwsIconUrl("dynamodb")).toContain("AmazonDynamoDB.svg");
    expect(getAwsIconUrl("redis")).toContain("AmazonElastiCache.svg");
    expect(getAwsIconUrl("vpc")).toContain("AmazonVirtualPrivateCloud.svg");
  });

  it("returns null for unknown type", () => {
    expect(getAwsIconUrl("unknown")).toBeNull();
    expect(getAwsIconUrl("")).toBeNull();
  });

  it("uses architecture-service path", () => {
    const url = getAwsIconUrl("ec2");
    expect(url).toContain("architecture-service");
    expect(url).toContain("AmazonEC2.svg");
  });
});
