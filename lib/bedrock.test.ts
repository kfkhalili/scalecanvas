import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Tracks modelId arguments passed to the bedrock provider — read by reference in tests
const providerCalls: string[] = [];

// Mock before importing so the factory runs before module evaluation
vi.mock("@ai-sdk/amazon-bedrock", () => {
  const mockModel = { __isMockModel: true };
  const mockProvider = vi.fn((modelId: string) => {
    providerCalls.push(modelId);
    return mockModel;
  });
  const createAmazonBedrock = vi.fn(() => mockProvider);
  return { createAmazonBedrock };
});

import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { getBedrockModel } from "./bedrock";

const mockedCreate = vi.mocked(createAmazonBedrock);

describe("getBedrockModel", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    providerCalls.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns success with a model when both env vars are set", () => {
    process.env.BEDROCK_MODEL_ID = "anthropic.claude-3-5-sonnet-20241022-v2:0";
    process.env.AWS_REGION = "us-east-1";

    const result = getBedrockModel();

    expect(result.success).toBe(true);
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(providerCalls).toHaveLength(1);
  });

  it("passes AWS credentials from env to createAmazonBedrock", () => {
    process.env.BEDROCK_MODEL_ID = "anthropic.claude-3-5-sonnet-20241022-v2:0";
    process.env.AWS_REGION = "eu-west-1";
    process.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
    process.env.AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

    getBedrockModel();

    expect(mockedCreate).toHaveBeenCalledWith({
      region: "eu-west-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    });
  });

  it("returns failure when BEDROCK_MODEL_ID is missing", () => {
    delete process.env.BEDROCK_MODEL_ID;
    process.env.AWS_REGION = "us-east-1";

    const result = getBedrockModel();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("BEDROCK_MODEL_ID");
    }
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("returns failure when AWS_REGION is missing", () => {
    process.env.BEDROCK_MODEL_ID = "anthropic.claude-3-5-sonnet-20241022-v2:0";
    delete process.env.AWS_REGION;

    const result = getBedrockModel();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("AWS_REGION");
    }
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("returns failure when both env vars are missing", () => {
    delete process.env.BEDROCK_MODEL_ID;
    delete process.env.AWS_REGION;

    const result = getBedrockModel();

    expect(result.success).toBe(false);
  });

  it("returns failure when BEDROCK_MODEL_ID is an empty string after trim", () => {
    process.env.BEDROCK_MODEL_ID = "  "; // whitespace only — trim makes it empty
    process.env.AWS_REGION = "us-east-1";

    const result = getBedrockModel();

    expect(result.success).toBe(false);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("rewrites the Claude Sonnet 4.6 model ID to the inference profile ID", () => {
    process.env.BEDROCK_MODEL_ID = "anthropic.claude-sonnet-4-6";
    process.env.AWS_REGION = "us-east-1";

    const result = getBedrockModel();

    expect(result.success).toBe(true);
    expect(providerCalls).toEqual(["global.anthropic.claude-sonnet-4-6"]);
  });

  it("does NOT rewrite other model IDs", () => {
    const modelId = "anthropic.claude-3-5-sonnet-20241022-v2:0";
    process.env.BEDROCK_MODEL_ID = modelId;
    process.env.AWS_REGION = "us-east-1";

    getBedrockModel();

    expect(providerCalls).toEqual([modelId]);
  });

  it("trims whitespace from BEDROCK_MODEL_ID before passing to provider", () => {
    process.env.BEDROCK_MODEL_ID = "  anthropic.claude-3-5-sonnet-20241022-v2:0  ";
    process.env.AWS_REGION = "us-east-1";

    const result = getBedrockModel();

    expect(result.success).toBe(true);
    expect(providerCalls).toEqual(["anthropic.claude-3-5-sonnet-20241022-v2:0"]);
  });
});
