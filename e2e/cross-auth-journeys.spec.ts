import { test, expect, type Page } from "@playwright/test";
import { bypassOAuthAndInject, getAuthCookieForHeader, mintServiceRoleToken } from "./jwtBypass";
import {
  isLocalSupabase,
  E2E_JOURNEY_USER_ID,
  E2E_JOURNEY_CONCLUSION_USER_ID,
} from "./env";
const ANONYMOUS_WORKSPACE_KEY = "scalecanvas-anonymous-workspace";

function nodeByLabel(page: Page, label: string) {
  return page.locator(".react-flow__node").filter({ hasText: label });
}

function getNodeCount(page: Page) {
  return page.locator(".react-flow__node").count();
}

async function dragServiceToCanvas(page: Page, label: string): Promise<void> {
  const source = page.getByText(label, { exact: true }).first();
  const canvas = page.locator(".react-flow");
  await source.dragTo(canvas);
}

const anonymousWorkspaceWithLambda = {
  state: {
    anonymousMessages: [{ id: "m1", role: "user", content: "Hello" }],
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

/**
 * Seeds the anonymous workspace into localStorage, injects a minted auth cookie,
 * and installs a route interceptor that appends that cookie to every SSR request.
 * Call before page.goto() in each test.
 */
async function setupAuthenticatedPage(
  page: Page,
  userId: string,
  baseURL: string | undefined
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
      payload: JSON.stringify(anonymousWorkspaceWithLambda),
    }
  );

  await bypassOAuthAndInject(
    page,
    userId,
    baseURL ?? "http://localhost:3000"
  );

  const origin = (baseURL ?? "http://localhost:3000").replace(/\/$/, "");
  const originRegex = new RegExp(
    "^" + origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(/.*)?$"
  );
  const { name: authCookieName, value: authCookieValue } = getAuthCookieForHeader(userId);
  await page.addInitScript(
    ({ name, value }: { name: string; value: string }) => {
      document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=3600; SameSite=Lax`;
    },
    { name: authCookieName, value: authCookieValue }
  );
  const cookieHeader = `${authCookieName}=${authCookieValue}`;
  await page.route(originRegex, (route) => {
    const req = route.request();
    const headersCopy: Record<string, string> = { ...req.headers() };
    headersCopy["cookie"] = headersCopy["cookie"]
      ? `${headersCopy["cookie"]}; ${cookieHeader}`
      : cookieHeader;

    // Use route.continue for ALL request types (including documents).
    // route.fulfill() changes Chromium's address-space for the page from
    // "local" to "public", triggering Private Network Access (PNA) checks
    // that block subsequent fetches to 127.0.0.1 (Supabase GoTrue).
    void route.continue({ headers: headersCopy });
  });
}

test.describe("Cross-auth user journeys (JWT bypass, no manual auth)", () => {
  test.beforeEach(async () => {
    test.skip(
      !isLocalSupabase(),
      "JWT bypass requires local Supabase (NEXT_PUBLIC_SUPABASE_URL with 127.0.0.1 or localhost)"
    );

    // Ensure e2e users exist (idempotent: 422 means already present).
    // The on_auth_user_created trigger creates the profiles row automatically.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
    const serviceToken = mintServiceRoleToken();
    const adminHeaders = {
      apikey: serviceToken,
      Authorization: `Bearer ${serviceToken}`,
      "Content-Type": "application/json",
    };
    const createResults = await Promise.all([
      fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          id: E2E_JOURNEY_USER_ID,
          email: "e2e-journey@example.com",
          email_confirm: true,
          password: "e2e-dummy-password",
        }),
      }),
      fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          id: E2E_JOURNEY_CONCLUSION_USER_ID,
          email: "e2e-conclusion@example.com",
          email_confirm: true,
          password: "e2e-dummy-password",
        }),
      }),
    ]);
    for (const res of createResults) {
      if (!res.ok && res.status !== 422) {
        throw new Error(
          `Admin user creation failed: ${res.status} ${res.statusText} (${res.url})`
        );
      }
    }

    // Reset trial state so the test is idempotent (prior runs may have claimed the trial).
    const restHeaders = {
      apikey: serviceToken,
      Authorization: `Bearer ${serviceToken}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };

    const resetResults = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/interview_sessions?user_id=eq.${E2E_JOURNEY_USER_ID}`,
        { method: "DELETE", headers: restHeaders }
      ),
      fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${E2E_JOURNEY_USER_ID}`,
        { method: "PATCH", headers: restHeaders, body: JSON.stringify({ trial_claimed_at: null }) }
      ),
      fetch(
        `${supabaseUrl}/rest/v1/interview_sessions?user_id=eq.${E2E_JOURNEY_CONCLUSION_USER_ID}`,
        { method: "DELETE", headers: restHeaders }
      ),
      fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${E2E_JOURNEY_CONCLUSION_USER_ID}`,
        { method: "PATCH", headers: restHeaders, body: JSON.stringify({ trial_claimed_at: null }) }
      ),
    ]);
    for (const res of resetResults) {
      if (!res.ok) {
        throw new Error(
          `State reset failed: ${res.status} ${res.statusText} (${res.url})`
        );
      }
    }
  });

  test("anonymous → sign in (bypass) → handoff → trial session, canvas persisted and survives reload", async ({
    page,
    baseURL,
  }) => {
    await setupAuthenticatedPage(page, E2E_JOURNEY_USER_ID, baseURL);

    const handoffCalls: { status: number }[] = [];
    page.on("response", (res) => {
      if (!res.url().includes("/api/auth/handoff") || res.request().method() !== "POST") return;
      handoffCalls.push({ status: res.status() });
    });

    const handoffResPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/auth/handoff") && res.request().method() === "POST",
      { timeout: 20_000 }
    );

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const url = page.url();
    const loadingVisible = await page.getByText("Loading session…").isVisible().catch(() => false);
    const signInVisible = await page.getByRole("button", { name: /sign in with google/i }).isVisible().catch(() => false);
    const isSessionUrl = /\/[0-9a-f-]{36}$/i.test(new URL(url).pathname);
    expect(
      isSessionUrl || loadingVisible || !signInVisible,
      `Server did not see auth: url=${url} loading=${loadingVisible} signInVisible=${signInVisible}`
    ).toBe(true);

    const handoffRes = await handoffResPromise.catch((e) => {
      console.log("[e2e] no handoff response. handoffCalls:", JSON.stringify(handoffCalls, null, 2));
      throw e;
    });
    const handoffBody = (await handoffRes.json()) as { created?: boolean; session_id?: string; error?: string };
    expect(handoffRes.status(), `handoff must succeed (got ${handoffRes.status()} ${JSON.stringify(handoffBody)})`).toBe(201);
    expect(handoffBody.created).toBe(true);
    expect(handoffBody.session_id).toBeDefined();

    await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  });

  test("anonymous → sign in (bypass) → handoff → end interview → canvas read-only and state correct after refresh", async ({
    page,
    baseURL,
  }) => {
    await setupAuthenticatedPage(page, E2E_JOURNEY_CONCLUSION_USER_ID, baseURL);

    const handoffLog: { status: number; body: unknown }[] = [];
    page.on("response", async (res) => {
      const url = res.url();
      if (url.includes("/api/auth/handoff") && res.request().method() === "POST") {
        const body = await res.json().catch(() => ({}));
        handoffLog.push({ status: res.status(), body });
      }
    });
    // Wait for the canvas PUT from runBffHandoff (awaited before navigation, but
    // we still capture it here to assert it completed before reading the canvas).
    const canvasSavedPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/sessions/") &&
        res.url().includes("/canvas") &&
        res.request().method() === "PUT",
      { timeout: 30_000 }
    );
    await page.goto("/");
    await page.waitForURL(/\/[0-9a-f-]{36}$/i, { timeout: 20_000 }).catch(async (e) => {
      console.log("[e2e] waitForURL failed. handoff API calls:", JSON.stringify(handoffLog, null, 2));
      const loading = await page.getByText("Loading session…").isVisible().catch(() => false);
      const signInVisible = await page.getByRole("button", { name: /sign in with google/i }).isVisible().catch(() => false);
      console.log("[e2e] current URL:", page.url(), "| Loading session?:", loading, "| Sign in visible?:", signInVisible);
      if (handoffLog.length === 0 && signInVisible) {
        console.log("[e2e] => Server did not see auth (anonymous view). Check cookie above and NEXT_PUBLIC_SUPABASE_URL in .env.local.");
      }
      throw e;
    });

    await canvasSavedPromise;
    // Canvas PUT is now in DB. Reload so InterviewSplitView re-fetches canvas
    // (it only fetches on mount; it won't re-fetch while already on the session page).
    await page.reload();
    await expect(nodeByLabel(page, "Lambda")).toBeVisible({ timeout: 10_000 });

    const endBtn = page.getByRole("button", { name: /end interview/i });
    await expect(endBtn).toBeVisible({ timeout: 5_000 });
    await endBtn.click();
    // Confirm the dialog that appears after the first click
    const confirmBtn = page.getByRole("button", { name: /end interview/i });
    await expect(confirmBtn).toBeVisible({ timeout: 3_000 });
    await confirmBtn.click();

    await expect(
      page.getByPlaceholder("This interview has ended.")
    ).toBeVisible({ timeout: 30_000 });

    // Persist conclusion to DB so that after reload the server returns isConcluded=true.
    const sessionUrl = page.url();
    const concludedSessionMatch = sessionUrl.match(/\/([0-9a-f-]{36})$/i);
    if (concludedSessionMatch) {
      const concludedSessionId = concludedSessionMatch[1];
      const svcToken = mintServiceRoleToken();
      const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
      await fetch(`${supaUrl}/rest/v1/interview_sessions?id=eq.${concludedSessionId}`, {
        method: "PATCH",
        headers: {
          apikey: svcToken,
          Authorization: `Bearer ${svcToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conclusion_summary: "Test conclusion summary." }),
      });
    }

    const countBefore = await getNodeCount(page);
    await dragServiceToCanvas(page, "S3");
    await page.waitForTimeout(500);
    expect(await getNodeCount(page)).toBe(countBefore);

    await page.reload();
    await expect(nodeByLabel(page, "Lambda")).toBeVisible({ timeout: 10_000 });
    expect(await getNodeCount(page)).toBe(1);
    await dragServiceToCanvas(page, "S3");
    await page.waitForTimeout(500);
    expect(await getNodeCount(page)).toBe(1);
  });
});
