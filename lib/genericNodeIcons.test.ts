import { describe, it, expect } from "vitest";
import { Option } from "effect";
import { getGenericIcon, isGenericNodeType } from "./genericNodeIcons";

describe("getGenericIcon", () => {
  it("returns some(icon) for generic node types", () => {
    expect(Option.isSome(getGenericIcon("genericClient"))).toBe(true);
    expect(Option.isSome(getGenericIcon("genericNosql"))).toBe(true);
    expect(Option.isSome(getGenericIcon("genericCache"))).toBe(true);
    expect(Option.isSome(getGenericIcon("genericApi"))).toBe(true);
    expect(Option.isSome(getGenericIcon("genericServerless"))).toBe(true);
    expect(Option.isSome(getGenericIcon("genericQueue"))).toBe(true);
    expect(Option.isSome(getGenericIcon("genericRelational"))).toBe(true);
  });

  it("returns none for AWS/non-generic types", () => {
    expect(Option.isNone(getGenericIcon("lambda"))).toBe(true);
    expect(Option.isNone(getGenericIcon("dynamodb"))).toBe(true);
    expect(Option.isNone(getGenericIcon("unknown"))).toBe(true);
    expect(Option.isNone(getGenericIcon(""))).toBe(true);
  });
});

describe("isGenericNodeType", () => {
  it("returns true for generic types", () => {
    expect(isGenericNodeType("genericClient")).toBe(true);
    expect(isGenericNodeType("genericNosql")).toBe(true);
    expect(isGenericNodeType("genericApi")).toBe(true);
  });

  it("returns false for non-generic types", () => {
    expect(isGenericNodeType("lambda")).toBe(false);
    expect(isGenericNodeType("text")).toBe(false);
  });
});
