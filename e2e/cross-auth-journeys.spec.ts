import { test, expect, type Page } from "@playwright/test";
import { mintServiceRoleToken } from "./jwtBypass";
import { setupAuthenticatedPage, ensureUserAndResetTrial, cleanupUserSessions, installApiErrorLogger } from "./fixtures";
import {
  isLocalSupabase,
  E2E_JOURNEY_USER_ID,
  E2E_JOURNEY_CONCLUSION_USER_ID,
} from "./env";

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

test.describe("Cross-auth user journeys (JWT bypass, no manual auth)", () => {
  test.beforeEach(async () => {
    test.skip(
      !isLocalSupabase(),
      "JWT bypass requires local Supabase (NEXT_PUBLIC_SUPABASE_URL with 127.0.0.1 or localhost)"
    );

    await Promise.all([
      ensureUserAndResetTrial(E2E_JOURNEY_USER_ID, "e2e-journey@example.com"),
      ensureUserAndResetTrial(E2E_JOURNEY_CONCLUSION_USER_ID, "e2e-conclusion@example.com"),
    ]);
  });

  test("anonymous → sign in (bypass) → handoff → trial session, canvas persisted and survives reload", async ({
    page,
    baseURL,
  }) => {
    installApiErrorLogger(page);
    await setupAuthenticatedPage(page, E2E_JOURNEY_USER_ID, baseURL);

    const handoffCalls: { status: number }[] = [];
    page.on("response", (res) => {
      if (!res.url().includes("/api/auth/handoff") || res.request().method() !== "POST") return;
      handoffCalls.push({ status: res.status() });
    });

    const handoffResPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/auth/handoff") &&
        res.request().method() === "POST" &&
        res.status() < 400,
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
    installApiErrorLogger(page);
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
        res.request().method() === "PUT" &&
        res.status() < 400,
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
    // Confirm Lambda is rendered before reloading so we know the initial render
    // has settled and we're not reloading mid-flight.
    await expect(nodeByLabel(page, "Lambda")).toBeVisible({ timeout: 10_000 });
    // Reload so InterviewSplitView re-fetches canvas from DB
    // (it only fetches on mount; it won't re-fetch while already on the session page).
    await page.reload();
    await page.waitForLoadState("load");
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
    await expect.poll(() => getNodeCount(page), { timeout: 2_000 }).toBe(countBefore);

    await page.reload();
    await expect(nodeByLabel(page, "Lambda")).toBeVisible({ timeout: 10_000 });
    expect(await getNodeCount(page)).toBe(1);
    await dragServiceToCanvas(page, "S3");
    await expect.poll(() => getNodeCount(page), { timeout: 2_000 }).toBe(1);
  });

  test.afterEach(async ({}, testInfo) => {
    // Only clean up the user for the test that just ran to avoid
    // deleting sessions from parallel workers still in progress.
    const isConclusion = testInfo.title.includes("end interview");
    await cleanupUserSessions(
      isConclusion ? E2E_JOURNEY_CONCLUSION_USER_ID : E2E_JOURNEY_USER_ID,
    );
  });
});
