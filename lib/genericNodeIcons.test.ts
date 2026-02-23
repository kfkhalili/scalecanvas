import { describe, it, expect } from "vitest";
import { getGenericIcon, isGenericNodeType } from "./genericNodeIcons";

describe("getGenericIcon", () => {
  it("returns icon for generic node types", () => {
    expect(getGenericIcon("genericNosql")).toBeDefined();
    expect(getGenericIcon("genericCache")).toBeDefined();
    expect(getGenericIcon("genericApi")).toBeDefined();
    expect(getGenericIcon("genericServerless")).toBeDefined();
    expect(getGenericIcon("genericQueue")).toBeDefined();
    expect(getGenericIcon("genericRelational")).toBeDefined();
  });

  it("returns null for AWS/non-generic types", () => {
    expect(getGenericIcon("lambda")).toBeNull();
    expect(getGenericIcon("dynamodb")).toBeNull();
    expect(getGenericIcon("unknown")).toBeNull();
    expect(getGenericIcon("")).toBeNull();
  });
});

describe("isGenericNodeType", () => {
  it("returns true for generic types", () => {
    expect(isGenericNodeType("genericNosql")).toBe(true);
    expect(isGenericNodeType("genericApi")).toBe(true);
  });

  it("returns false for non-generic types", () => {
    expect(isGenericNodeType("lambda")).toBe(false);
    expect(isGenericNodeType("text")).toBe(false);
  });
});
