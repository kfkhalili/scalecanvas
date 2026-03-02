/**
 * Deterministic JWT minting and OAuth bypass for e2e tests.
 * Bypasses Google and Supabase GoTrue. Injects session so the app sees it:
 * - Sets the session cookie for the app domain via Playwright addCookies (so SSR sees the user).
 * - Sets localStorage via addInitScript so client-side code sees the session.
 * - Intercepts auth/v1/authorize and fulfills with 302 to app origin (no real OAuth).
 */

import * as jwt from "jsonwebtoken";
import { getSupabaseAuthCookieName } from "../lib/supabaseAuthCookieName";

const SUPABASE_JWT_SECRET =
  "super-secret-jwt-token-with-at-least-32-characters-long";

export type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: "bearer";
  user: {
    id: string;
    email: string;
    aud: string;
    role: string;
  };
};

/**
 * Pure function: sign a JWT for the given user. Payload includes
 * aud: 'authenticated', role: 'authenticated', sub: userId.
 * Uses the standard local Supabase JWT secret.
 */
export function mintSupabaseToken(userId: string): string {
  const payload = {
    aud: "authenticated",
    role: "authenticated",
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
  return jwt.sign(payload, SUPABASE_JWT_SECRET, { algorithm: "HS256" });
}

/**
 * Return a service_role token for admin operations (e.g. test cleanup via PostgREST).
 * Prefers SUPABASE_SERVICE_ROLE_KEY env var (the exact static key Supabase was
 * started with) so Kong accepts it without ambiguity. Falls back to minting a
 * fresh JWT when the env var is absent (local dev without the variable set).
 */
export function mintServiceRoleToken(): string {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  return jwt.sign(
    {
      role: "service_role",
      iss: "supabase",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    SUPABASE_JWT_SECRET,
    { algorithm: "HS256" }
  );
}

/**
 * Pure function: return a structurally valid Supabase session object
 * containing the token and minimal user data.
 */
export function createMockSession(userId: string, token: string): SupabaseSession {
  return {
    access_token: token,
    refresh_token: `mock-refresh-${userId}`,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: userId,
      email: `test-${userId}@example.com`,
      aud: "authenticated",
      role: "authenticated",
    },
  };
}

type CookieEntry = {
  name: string;
  value: string;
  url?: string;
  domain?: string;
  path?: string;
};

type PageWithContext = {
  context: () => {
    addInitScript: (
      fn: (args: { key: string; payload: string }) => void,
      args: { key: string; payload: string }
    ) => Promise<void>;
    addCookies: (cookies: CookieEntry[]) => Promise<void>;
  };
  route: (
    url: string | RegExp,
    handler: (route: {
      request: () => { url: () => string };
      fulfill: (opts: { status: number; headers: Record<string, string> }) => Promise<void>;
    }) => Promise<void>
  ) => Promise<void>;
};

/**
 * Route interceptor: intercept auth/v1/authorize (any provider),
 * mint token and session, inject session into localStorage via addInitScript,
 * and fulfill with a 302 redirect to the authenticated dashboard.
 * Does not use signInWithPassword, signInWithOAuth, or automate Google UI.
 *
 * Cookie name must match the app (see lib/supabaseAuthCookieName). Pass supabaseUrl
 * so the same name is used; if not set, uses http://127.0.0.1:54321 (sb-local-auth-token).
 *
 * @param redirectOrigin - Full origin of the app (e.g. http://localhost:3000) for the redirect Location.
 */
export async function bypassOAuthAndInject(
  page: PageWithContext,
  userId: string,
  redirectOrigin: string = "http://localhost:3000",
  supabaseUrl?: string
): Promise<void> {
  const cookieName = getSupabaseAuthCookieName(
    supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
  );

  const token = mintSupabaseToken(userId);
  const session = createMockSession(userId, token);
  const payload = JSON.stringify(session);

  await page.context().addInitScript(
    (args: { key: string; payload: string }) => {
      window.localStorage.setItem(args.key, args.payload);
    },
    { key: cookieName, payload }
  );

  const dashboardUrl = `${redirectOrigin.replace(/\/$/, "")}/`;
  const sessionJson = JSON.stringify(session);
  const cookieValue =
    "base64-" + Buffer.from(sessionJson, "utf8").toString("base64url");

  const originUrl = new URL(dashboardUrl);
  const isLocalhost =
    originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1";
  const cookieEntry = isLocalhost
    ? {
        name: cookieName,
        value: cookieValue,
        domain: originUrl.hostname,
        path: "/",
        sameSite: "Lax" as const,
        secure: false,
      }
    : { name: cookieName, value: cookieValue, url: dashboardUrl };
  await page.context().addCookies([cookieEntry]);

  await page.route("**/auth/v1/authorize*", async (route) => {
    await route.fulfill({
      status: 302,
      headers: { Location: dashboardUrl },
    });
  });
}

/**
 * Returns the auth cookie name and value for manual injection (e.g. into request headers).
 * Use when addCookies is not sending the cookie on the first request to the app origin.
 */
export function getAuthCookieForHeader(
  userId: string,
  supabaseUrl?: string
): { name: string; value: string } {
  const cookieName = getSupabaseAuthCookieName(
    supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
  );
  const token = mintSupabaseToken(userId);
  const session = createMockSession(userId, token);
  const sessionJson = JSON.stringify(session);
  const value =
    "base64-" + Buffer.from(sessionJson, "utf8").toString("base64url");
  return { name: cookieName, value };
}
