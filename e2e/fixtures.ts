/**
 * Shared E2E test fixtures and helpers.
 *
 * Centralises user setup, authenticated page bootstrapping, and anonymous
 * workspace payloads so test files stay focused on assertions.
 */

import type { Page } from "@playwright/test";
import {
  bypassOAuthAndInject,
  getAuthCookieForHeader,
  mintServiceRoleToken,
} from "./jwtBypass";

const ANONYMOUS_WORKSPACE_KEY = "scalecanvas-anonymous-workspace";

// ---------------------------------------------------------------------------
// Anonymous workspace payloads
// ---------------------------------------------------------------------------

/** Standard anonymous workspace with a single Lambda node and one user message. */
export const anonymousWorkspaceWithLambda = {
  state: {
    anonymousMessages: [
      { id: "e2e00000-0000-4000-8000-bbbbbbbbbbbb", role: "user", content: "Hello" },
    ],
    questionTitle: "URL Shortener",
    questionTopicId: null,
    nodes: [
      {
        id: "n1",
        type: "awsLambda",
        position: { x: 100, y: 100 },
        data: { label: "Lambda" },
      },
    ],
    edges: [] as unknown[],
    hasAttemptedEval: true,
    viewport: undefined,
  },
  version: 0,
};

// ---------------------------------------------------------------------------
// Authenticated page setup
// ---------------------------------------------------------------------------

/**
 * Seeds the anonymous workspace into localStorage, injects a minted auth cookie,
 * and installs a route interceptor that appends that cookie to every SSR request.
 *
 * Call **before** `page.goto()` in each test.
 *
 * Uses `route.continue()` (not `route.fulfill()`) to avoid changing Chromium's
 * address-space classification, which would trigger Private Network Access (PNA)
 * preflight checks and block subsequent fetches to 127.0.0.1 (local Supabase).
 */
export async function setupAuthenticatedPage(
  page: Page,
  userId: string,
  baseURL: string | undefined,
  workspace: { state: unknown; version: number } = anonymousWorkspaceWithLambda,
): Promise<void> {
  await page.addInitScript(() => {
    (window as Window & { __E2E_DEBUG__?: boolean }).__E2E_DEBUG__ = true;
  });
  await page.addInitScript(
    ({ key, payload }: { key: string; payload: string }) => {
      localStorage.setItem(key, payload);
    },
    {
      key: ANONYMOUS_WORKSPACE_KEY,
      payload: JSON.stringify(workspace),
    },
  );

  await bypassOAuthAndInject(
    page,
    userId,
    baseURL ?? "http://localhost:3000",
  );

  const origin = (baseURL ?? "http://localhost:3000").replace(/\/$/, "");
  const originRegex = new RegExp(
    "^" + origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(/.*)?$",
  );
  const { name: authCookieName, value: authCookieValue } =
    getAuthCookieForHeader(userId);
  await page.addInitScript(
    ({ name, value }: { name: string; value: string }) => {
      document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=3600; SameSite=Lax`;
    },
    { name: authCookieName, value: authCookieValue },
  );
  const cookieHeader = `${authCookieName}=${authCookieValue}`;
  await page.route(originRegex, (route) => {
    const req = route.request();
    const headersCopy: Record<string, string> = { ...req.headers() };
    headersCopy["cookie"] = headersCopy["cookie"]
      ? `${headersCopy["cookie"]}; ${cookieHeader}`
      : cookieHeader;
    void route.continue({ headers: headersCopy });
  });
}

// ---------------------------------------------------------------------------
// GoTrue user management
// ---------------------------------------------------------------------------

/**
 * Creates the e2e user via GoTrace admin API (idempotent) and resets trial state.
 *
 * Handles common local-Supabase pitfalls:
 * - 422 `email_exists`: another user already owns the email → reassign their
 *   email to a throwaway value, then retry creation.
 * - 500 + 23505: the UUID collides in a leftover table → delete then recreate.
 * - User exists with correct ID: just verify + reset trial state.
 */
export async function ensureUserAndResetTrial(
  userId: string,
  email: string,
): Promise<void> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const serviceToken = mintServiceRoleToken();
  const adminHeaders = {
    apikey: serviceToken,
    Authorization: `Bearer ${serviceToken}`,
    "Content-Type": "application/json",
  };

  // 1. Check if the user already exists with the right ID
  const getRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    headers: adminHeaders,
  });
  if (getRes.status === 200) {
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ email, email_confirm: true }),
    });
  } else {
    // 2. User doesn't exist — create it
    let createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        id: userId,
        email,
        email_confirm: true,
        password: "e2e-dummy-password",
      }),
    });

    if (!createRes.ok) {
      const body = await createRes.text().catch(() => "");

      if (createRes.status === 422 && body.includes("email_exists")) {
        const listRes = await fetch(
          `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=50`,
          { headers: adminHeaders },
        );
        const listData = (await listRes.json()) as {
          users?: { id: string; email: string }[];
        };
        const conflicting = listData.users?.find((u) => u.email === email);
        if (conflicting) {
          await fetch(
            `${supabaseUrl}/auth/v1/admin/users/${conflicting.id}`,
            {
              method: "PUT",
              headers: adminHeaders,
              body: JSON.stringify({
                email: `orphan-${conflicting.id.slice(0, 8)}@example.com`,
                email_confirm: true,
              }),
            },
          );
        }
        createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: "POST",
          headers: adminHeaders,
          body: JSON.stringify({
            id: userId,
            email,
            email_confirm: true,
            password: "e2e-dummy-password",
          }),
        });
      } else if (body.includes("23505")) {
        await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
          method: "DELETE",
          headers: adminHeaders,
        });
        createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: "POST",
          headers: adminHeaders,
          body: JSON.stringify({
            id: userId,
            email,
            email_confirm: true,
            password: "e2e-dummy-password",
          }),
        });
      }

      if (!createRes.ok && createRes.status !== 422) {
        const finalBody = await createRes.text().catch(() => "");
        throw new Error(
          `Admin user creation failed: ${createRes.status} ${createRes.statusText} — ${finalBody}`,
        );
      }
    }
  }

  // 3. Reset trial state
  const restHeaders = {
    apikey: serviceToken,
    Authorization: `Bearer ${serviceToken}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
  const resetResults = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/interview_sessions?user_id=eq.${userId}`,
      { method: "DELETE", headers: restHeaders },
    ),
    fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers: restHeaders,
      body: JSON.stringify({ trial_claimed_at: null }),
    }),
  ]);
  for (const res of resetResults) {
    if (!res.ok) {
      throw new Error(
        `State reset failed: ${res.status} ${res.statusText} (${res.url})`,
      );
    }
  }
}
