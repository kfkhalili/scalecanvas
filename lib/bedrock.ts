import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";

type BedrockModel = ReturnType<ReturnType<typeof createAmazonBedrock>>;

export type BedrockModelResult =
  | { readonly success: true; readonly model: BedrockModel }
  | { readonly success: false; readonly error: string };

/**
 * Reads Bedrock env vars, applies the Claude Sonnet 4.6 inference-profile fix,
 * and returns a ready-to-use language model.
 *
 * Always call this in server-side route handlers — never on the client.
 */
export function getBedrockModel(): BedrockModelResult {
  let modelId = process.env.BEDROCK_MODEL_ID?.trim();
  const region = process.env.AWS_REGION;
  if (!modelId || !region) {
    return {
      success: false,
      error:
        "Server misconfiguration: BEDROCK_MODEL_ID and AWS_REGION are required.",
    };
  }
  // Claude Sonnet 4.6 requires an inference profile; raw model ID is not supported for on-demand.
  if (modelId === "anthropic.claude-sonnet-4-6") {
    modelId = "global.anthropic.claude-sonnet-4-6";
  }
  const bedrock = createAmazonBedrock({
    region,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });
  return { success: true, model: bedrock(modelId) };
}
