import { describe, it, expect } from "vitest";
import {
  mintSupabaseToken,
  createMockSession,
  type SupabaseSession,
} from "./jwtBypass";
import * as jwt from "jsonwebtoken";

const SUPABASE_JWT_SECRET =
  "super-secret-jwt-token-with-at-least-32-characters-long";

describe("jwtBypass", () => {
  describe("mintSupabaseToken", () => {
    it("returns a JWT string", () => {
      const token = mintSupabaseToken("user-1");
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("payload includes aud, role, sub", () => {
      const token = mintSupabaseToken("user-42");
      const decoded = jwt.verify(token, SUPABASE_JWT_SECRET) as {
        aud?: string;
        role?: string;
        sub?: string;
      };
      expect(decoded.aud).toBe("authenticated");
      expect(decoded.role).toBe("authenticated");
      expect(decoded.sub).toBe("user-42");
    });

    it("is valid when verified with the same secret", () => {
      const token = mintSupabaseToken("e2e-bypass-user");
      expect(() => jwt.verify(token, SUPABASE_JWT_SECRET)).not.toThrow();
    });
  });

  describe("createMockSession", () => {
    it("returns session with token and user id", () => {
      const token = mintSupabaseToken("user-1");
      const session = createMockSession("user-1", token);
      expect(session.access_token).toBe(token);
      expect(session.user.id).toBe("user-1");
      expect(session.token_type).toBe("bearer");
    });

    it("session has required Supabase shape", () => {
      const token = "fake.jwt.token";
      const session = createMockSession("id", token) as SupabaseSession;
      expect(session).toHaveProperty("access_token");
      expect(session).toHaveProperty("refresh_token");
      expect(session).toHaveProperty("expires_in");
      expect(session).toHaveProperty("expires_at");
      expect(session).toHaveProperty("user");
      expect(session.user).toHaveProperty("aud", "authenticated");
      expect(session.user).toHaveProperty("role", "authenticated");
    });
  });
});
