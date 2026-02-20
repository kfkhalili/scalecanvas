import { describe, it, expect } from "vitest";
import type { User } from "@supabase/supabase-js";
import {
  getAvatarUrl,
  getDisplayName,
  getProviderLabel,
  getInitials,
} from "./userProfile";

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "alice@example.com",
    app_metadata: { provider: "google" },
    user_metadata: {
      full_name: "Alice Smith",
      avatar_url: "https://example.com/avatar.jpg",
    },
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  } as User;
}

describe("getAvatarUrl", () => {
  it("returns avatar_url from user_metadata", () => {
    expect(getAvatarUrl(fakeUser())).toBe("https://example.com/avatar.jpg");
  });

  it("returns null when no avatar_url", () => {
    expect(getAvatarUrl(fakeUser({ user_metadata: {} }))).toBeNull();
  });

  it("returns null when avatar_url is not a string", () => {
    expect(getAvatarUrl(fakeUser({ user_metadata: { avatar_url: 42 } }))).toBeNull();
  });
});

describe("getDisplayName", () => {
  it("returns full_name from user_metadata", () => {
    expect(getDisplayName(fakeUser())).toBe("Alice Smith");
  });

  it("falls back to name field", () => {
    const user = fakeUser({ user_metadata: { name: "Bob" } });
    expect(getDisplayName(user)).toBe("Bob");
  });

  it("falls back to user_name field", () => {
    const user = fakeUser({ user_metadata: { user_name: "charlie" } });
    expect(getDisplayName(user)).toBe("charlie");
  });

  it("returns null when no name fields", () => {
    expect(getDisplayName(fakeUser({ user_metadata: {} }))).toBeNull();
  });
});

describe("getProviderLabel", () => {
  it("returns 'Google Account' for google provider", () => {
    expect(getProviderLabel(fakeUser())).toBe("Google Account");
  });

  it("returns 'GitHub Account' for github provider", () => {
    const user = fakeUser({ app_metadata: { provider: "github" } });
    expect(getProviderLabel(user)).toBe("GitHub Account");
  });

  it("returns 'Account' for unknown provider", () => {
    const user = fakeUser({ app_metadata: { provider: "email" } });
    expect(getProviderLabel(user)).toBe("Account");
  });

  it("returns 'Account' when provider is missing", () => {
    const user = fakeUser({ app_metadata: {} });
    expect(getProviderLabel(user)).toBe("Account");
  });
});

describe("getInitials", () => {
  it("returns first letters of first and last name", () => {
    expect(getInitials(fakeUser())).toBe("AS");
  });

  it("returns single initial for single-word name", () => {
    const user = fakeUser({ user_metadata: { full_name: "Khalid" } });
    expect(getInitials(user)).toBe("K");
  });

  it("caps at two initials for long names", () => {
    const user = fakeUser({ user_metadata: { full_name: "John William Smith III" } });
    expect(getInitials(user)).toBe("JW");
  });

  it("falls back to first letter of email when no name", () => {
    const user = fakeUser({ user_metadata: {}, email: "zara@example.com" });
    expect(getInitials(user)).toBe("Z");
  });

  it("returns '?' when no name and no email", () => {
    const user = fakeUser({ user_metadata: {}, email: undefined });
    expect(getInitials(user)).toBe("?");
  });
});
