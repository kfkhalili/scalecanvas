import { describe, it, expect } from "vitest";
import { Option } from "effect";
import { getAzureIconUrl, isAzureNodeType } from "./azureNodeIcons";

describe("getAzureIconUrl", () => {
  it("returns some(path) for azureFunctions", () => {
    const url = Option.getOrNull(getAzureIconUrl("azureFunctions"));
    expect(url).toMatch(/^\/icons\/azure\//);
    expect(url).toContain(".svg");
  });

  it("returns some(path) for azureCosmosDb and azureKeyVault", () => {
    expect(Option.getOrNull(getAzureIconUrl("azureCosmosDb"))).toMatch(
      /^\/icons\/azure\//
    );
    expect(Option.getOrNull(getAzureIconUrl("azureKeyVault"))).toMatch(
      /^\/icons\/azure\//
    );
  });

  it("returns none for non-Azure types", () => {
    expect(Option.isNone(getAzureIconUrl("awsLambda"))).toBe(true);
    expect(Option.isNone(getAzureIconUrl("gcpGke"))).toBe(true);
    expect(Option.isNone(getAzureIconUrl("genericNosql"))).toBe(true);
    expect(Option.isNone(getAzureIconUrl(""))).toBe(true);
  });
});

describe("isAzureNodeType", () => {
  it("returns true for Azure catalog types", () => {
    expect(isAzureNodeType("azureFunctions")).toBe(true);
    expect(isAzureNodeType("azureCosmosDb")).toBe(true);
  });

  it("returns false for other types", () => {
    expect(isAzureNodeType("awsLambda")).toBe(false);
    expect(isAzureNodeType("azureUnknown")).toBe(false);
  });
});
