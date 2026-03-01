import { describe, it, expect } from "vitest";
import { getSupabaseAuthCookieName } from "./supabaseAuthCookieName";

describe("getSupabaseAuthCookieName", () => {
  it("uses the project ref for a hosted supabase.co URL", () => {
    expect(getSupabaseAuthCookieName("https://abcdefghijkl.supabase.co")).toBe(
      "sb-abcdefghijkl-auth-token"
    );
  });

  it("uses 'local' for 127.0.0.1", () => {
    expect(getSupabaseAuthCookieName("http://127.0.0.1:54321")).toBe(
      "sb-local-auth-token"
    );
  });

  it("uses 'local' for localhost", () => {
    expect(getSupabaseAuthCookieName("http://localhost:54321")).toBe(
      "sb-local-auth-token"
    );
  });

  it("uses the hostname for an unrecognised URL", () => {
    expect(getSupabaseAuthCookieName("https://mycompany.internal:8080")).toBe(
      "sb-mycompany.internal-auth-token"
    );
  });

  it("falls back to 'local' for an invalid URL", () => {
    expect(getSupabaseAuthCookieName("not-a-url")).toBe("sb-local-auth-token");
  });

  it("is case-insensitive for the hostname", () => {
    expect(getSupabaseAuthCookieName("https://ABCDEF.supabase.co")).toBe(
      "sb-abcdef-auth-token"
    );
  });
});
