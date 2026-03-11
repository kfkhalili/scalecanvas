import { test, expect } from "@playwright/test";
import { setupAuthenticatedPage, ensureUserAndResetTrial, cleanupUserSessions, installApiErrorLogger, assertNoUnexpected5xx } from "./fixtures";
import {
  isLocalSupabase,
  E2E_HANDOFF_DEDUP_USER_ID,
  E2E_HANDOFF_CANVAS_USER_ID,
  E2E_HANDOFF_TRANSCRIPT_USER_ID,
  TIMEOUT_NAVIGATION,
  TIMEOUT_SERVER,
  TIMEOUT_VISIBLE,
} from "./env";

test.describe("Handoff resilience", () => {
  test.beforeEach(async () => {
    test.skip(
      !isLocalSupabase(),
      "JWT bypass requires local Supabase"
    );
  });

  test("only one handoff API call despite React Strict Mode double-fire", async ({
    page,
    baseURL,
  }) => {
    await ensureUserAndResetTrial(
      E2E_HANDOFF_DEDUP_USER_ID,
      "e2e-handoff-dedup@example.com"
    );
    const apiErrors = installApiErrorLogger(page);
    await setupAuthenticatedPage(page, E2E_HANDOFF_DEDUP_USER_ID, baseURL);

    // Track every POST to /api/auth/handoff
    const handoffCalls: { status: number; body: unknown }[] = [];
    page.on("response", async (res) => {
      if (
        res.url().includes("/api/auth/handoff") &&
        res.request().method() === "POST"
      ) {
        const body = await res.json().catch(() => ({}));
        handoffCalls.push({ status: res.status(), body });
      }
    });

    await page.goto("/");

    // Wait for the handoff to complete and navigate to the session page
    await page.waitForURL(/\/[0-9a-f-]{36}$/i, { timeout: TIMEOUT_NAVIGATION });

    // Wait for the canvas to render and settle — once it has a save status,
    // the page is fully loaded and no more handoff calls should fire.
    await page.waitForSelector("[data-save-status]", { timeout: TIMEOUT_VISIBLE });

    // The bootstrapCalledRef guard should prevent more than one handoff API call
    expect(
      handoffCalls.length,
      `Expected exactly 1 handoff call, got ${handoffCalls.length}: ${JSON.stringify(handoffCalls)}`
    ).toBe(1);
    expect(handoffCalls[0].status).toBe(201);
    assertNoUnexpected5xx(apiErrors);
  });

  test("canvas save retries on transient failure and persists after retry", async ({
    page,
    baseURL,
  }) => {
    await ensureUserAndResetTrial(
      E2E_HANDOFF_CANVAS_USER_ID,
      "e2e-handoff-canvas@example.com"
    );
    installApiErrorLogger(page);
    await setupAuthenticatedPage(page, E2E_HANDOFF_CANVAS_USER_ID, baseURL);

    // Intercept PUT /api/sessions/*/canvas: fail the first attempt, let retries through.
    let canvasPutCount = 0;
    await page.route("**/api/sessions/*/canvas", (route) => {
      if (route.request().method() !== "PUT") {
        void route.fallback();
        return;
      }
      canvasPutCount++;
      if (canvasPutCount === 1) {
        // Simulate a network-level failure on the first attempt.
        // Use abort (not fulfill) to preserve Chromium's "local" address-space
        // classification — see e2e/README.md on PNA.
        void route.abort("failed");
      } else {
        // Fall through to the auth cookie injection route
        void route.fallback();
      }
    });

    // Wait for the canvas PUT retry to succeed (second attempt)
    const canvasSuccessPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/sessions/") &&
        res.url().includes("/canvas") &&
        res.request().method() === "PUT" &&
        res.status() < 400,
      { timeout: TIMEOUT_SERVER }
    );

    await page.goto("/");
    await page.waitForURL(/\/[0-9a-f-]{36}$/i, { timeout: TIMEOUT_NAVIGATION });

    await canvasSuccessPromise;

    // The retry mechanism should have sent at least 2 PUT requests
    expect(
      canvasPutCount,
      `Expected ≥2 canvas PUT attempts (1 failed + 1 succeeded), got ${canvasPutCount}`
    ).toBeGreaterThanOrEqual(2);

    // Confirm Lambda rendered before reloading so the initial render has settled.
    await expect(
      page.locator(".react-flow__node").filter({ hasText: "Lambda" })
    ).toBeVisible({ timeout: TIMEOUT_VISIBLE });

    // Verify canvas was actually persisted: reload and check node is still visible
    await page.reload();
    await page.waitForLoadState("load");
    await expect(
      page.locator(".react-flow__node").filter({ hasText: "Lambda" })
    ).toBeVisible({ timeout: TIMEOUT_VISIBLE });
  });

  test("transcript save retries on transient failure and persists", async ({
    page,
    baseURL,
  }) => {
    await ensureUserAndResetTrial(
      E2E_HANDOFF_TRANSCRIPT_USER_ID,
      "e2e-handoff-transcript@example.com"
    );
    installApiErrorLogger(page);
    await setupAuthenticatedPage(page, E2E_HANDOFF_TRANSCRIPT_USER_ID, baseURL);

    // Intercept POST to the transcript batch endpoint: abort the first attempt
    // so the saveWithBackoff retry logic is exercised, then let retries through.
    let batchPostCount = 0;
    await page.route("**/api/sessions/*/transcript/batch", (route) => {
      if (route.request().method() !== "POST") {
        void route.fallback();
        return;
      }
      batchPostCount++;
      if (batchPostCount === 1) {
        // Simulate a network-level failure on the first attempt
        void route.abort("failed");
      } else {
        // Fall through to the auth cookie injection route
        void route.fallback();
      }
    });

    // Wait for a successful transcript batch POST (the retry)
    const batchSuccessPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/transcript/batch") &&
        res.request().method() === "POST" &&
        res.status() < 400,
      { timeout: TIMEOUT_SERVER }
    );

    await page.goto("/");
    await page.waitForURL(/\/[0-9a-f-]{36}$/i, { timeout: TIMEOUT_NAVIGATION });

    await batchSuccessPromise;

    // The retry mechanism should have sent at least 2 batch POST requests
    expect(
      batchPostCount,
      `Expected ≥2 transcript batch POST attempts (1 failed + 1 succeeded), got ${batchPostCount}`
    ).toBeGreaterThanOrEqual(2);
  });

  test.afterEach(
    async ({}, testInfo) => {
      // Derive user ID from test annotation stored in testInfo.annotations,
      // falling back to the title-based map for backward compatibility.
      const userMap: Record<string, string> = {
        "only one handoff API call despite React Strict Mode double-fire":
          E2E_HANDOFF_DEDUP_USER_ID,
        "canvas save retries on transient failure and persists after retry":
          E2E_HANDOFF_CANVAS_USER_ID,
        "transcript save retries on transient failure and persists":
          E2E_HANDOFF_TRANSCRIPT_USER_ID,
      };
      const userId = userMap[testInfo.title];
      if (userId) {
        await cleanupUserSessions(userId);
      } else {
        console.warn(`[e2e cleanup] No user mapping for test: "${testInfo.title}"`);
      }
    },
  );
});
