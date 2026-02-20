import { describe, it, expect } from "vitest";
import { awsNodeTypes } from "./nodeTypes";
import { TextBoxNode } from "./nodes/TextBoxNode";
import { AwsNode } from "./nodes/AwsNode";
import { SERVICE_CATALOG } from "@/lib/serviceCatalog";

describe("awsNodeTypes", () => {
  it("registers text as TextBoxNode (not AwsNode)", () => {
    expect(awsNodeTypes["text"]).toBe(TextBoxNode);
  });

  it("registers exactly one handler for text (catalog text filtered from AwsNode mapping)", () => {
    const textKeys = Object.entries(awsNodeTypes).filter(([, component]) => component === TextBoxNode);
    expect(textKeys).toHaveLength(1);
    expect(textKeys[0][0]).toBe("text");
  });

  it("registers AwsNode for every catalog entry except type text", () => {
    const awsCatalogTypes = SERVICE_CATALOG.filter((s) => s.type !== "text").map((s) => s.type);
    for (const type of awsCatalogTypes) {
      expect(awsNodeTypes[type]).toBe(AwsNode);
    }
  });
});
