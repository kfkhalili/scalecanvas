import { describe, it, expect } from "vitest";
import { isValidOrigin, isMutationMethod } from "./csrf";

describe("isValidOrigin", () => {
  it("returns true when origin host matches request host", () => {
    expect(isValidOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
  });

  it("returns true for HTTPS origin matching host", () => {
    expect(isValidOrigin("https://example.com", "example.com")).toBe(true);
  });

  it("returns false when origin host differs", () => {
    expect(isValidOrigin("https://evil.com", "example.com")).toBe(false);
  });

  it("returns false when origin is null", () => {
    expect(isValidOrigin(null, "localhost:3000")).toBe(false);
  });

  it("returns false when host is null", () => {
    expect(isValidOrigin("http://localhost:3000", null)).toBe(false);
  });

  it("returns false for malformed origin", () => {
    expect(isValidOrigin("not-a-url", "localhost")).toBe(false);
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
