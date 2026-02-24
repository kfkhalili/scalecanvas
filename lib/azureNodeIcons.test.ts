import { describe, it, expect } from "vitest";
import { getAzureIconUrl, isAzureNodeType } from "./azureNodeIcons";

describe("getAzureIconUrl", () => {
  it("returns path for azureFunctions", () => {
    const url = getAzureIconUrl("azureFunctions");
    expect(url).toMatch(/^\/icons\/azure\//);
    expect(url).toContain(".svg");
  });

  it("returns path for azureCosmosDb and azureKeyVault", () => {
    expect(getAzureIconUrl("azureCosmosDb")).toMatch(/^\/icons\/azure\//);
    expect(getAzureIconUrl("azureKeyVault")).toMatch(/^\/icons\/azure\//);
  });

  it("returns null for non-Azure types", () => {
    expect(getAzureIconUrl("awsLambda")).toBeNull();
    expect(getAzureIconUrl("gcpGke")).toBeNull();
    expect(getAzureIconUrl("genericNosql")).toBeNull();
    expect(getAzureIconUrl("")).toBeNull();
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
