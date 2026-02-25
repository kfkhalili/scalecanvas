import { describe, it, expect } from "vitest";
import { Option } from "effect";
import { isValidOrigin, isMutationMethod } from "./csrf";

describe("isValidOrigin", () => {
  it("returns true when origin host matches request host", () => {
    expect(
      isValidOrigin(
        Option.some("http://localhost:3000"),
        Option.some("localhost:3000")
      )
    ).toBe(true);
  });

  it("returns true for HTTPS origin matching host", () => {
    expect(
      isValidOrigin(
        Option.some("https://example.com"),
        Option.some("example.com")
      )
    ).toBe(true);
  });

  it("returns false when origin host differs", () => {
    expect(
      isValidOrigin(
        Option.some("https://evil.com"),
        Option.some("example.com")
      )
    ).toBe(false);
  });

  it("returns false when origin is none", () => {
    expect(
      isValidOrigin(Option.none(), Option.some("localhost:3000"))
    ).toBe(false);
  });

  it("returns false when host is none", () => {
    expect(
      isValidOrigin(Option.some("http://localhost:3000"), Option.none())
    ).toBe(false);
  });

  it("returns false for malformed origin", () => {
    expect(
      isValidOrigin(Option.some("not-a-url"), Option.some("localhost"))
    ).toBe(false);
  });
});

describe("isMutationMethod", () => {
  it("returns true for POST", () => {
    expect(isMutationMethod("POST")).toBe(true);
  });

  it("returns true for PUT", () => {
    expect(isMutationMethod("PUT")).toBe(true);
  });

  it("returns true for DELETE", () => {
    expect(isMutationMethod("DELETE")).toBe(true);
  });

  it("returns false for GET", () => {
    expect(isMutationMethod("GET")).toBe(false);
  });

  it("is case insensitive", () => {
    expect(isMutationMethod("post")).toBe(true);
  });
});
