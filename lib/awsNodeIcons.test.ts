import { describe, it, expect } from "vitest";
import { Option } from "effect";
import { getAwsIconUrl } from "./awsNodeIcons";

describe("getAwsIconUrl", () => {
  it("returns some(unpkg URL) for known types (awsPrefixSmallName)", () => {
    expect(Option.getOrNull(getAwsIconUrl("awsLambda"))).toContain("unpkg.com");
    expect(Option.getOrNull(getAwsIconUrl("awsLambda"))).toContain("AWSLambda.svg");
    expect(Option.getOrNull(getAwsIconUrl("awsS3"))).toContain(
      "AmazonSimpleStorageService.svg"
    );
    expect(Option.getOrNull(getAwsIconUrl("awsDynamodb"))).toContain(
      "AmazonDynamoDB.svg"
    );
    expect(Option.getOrNull(getAwsIconUrl("awsRedis"))).toContain(
      "AmazonElastiCache.svg"
    );
    expect(Option.getOrNull(getAwsIconUrl("awsVpc"))).toContain(
      "AmazonVirtualPrivateCloud.svg"
    );
  });

  it("returns none for unknown type", () => {
    expect(Option.isNone(getAwsIconUrl("unknown"))).toBe(true);
    expect(Option.isNone(getAwsIconUrl(""))).toBe(true);
  });

  it("uses architecture-service path", () => {
    const url = Option.getOrNull(getAwsIconUrl("awsEc2"));
    expect(url).toContain("architecture-service");
    expect(url).toContain("AmazonEC2.svg");
  });
});
