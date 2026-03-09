import { test, expect } from "@playwright/test";
import { setupAuthenticatedPage, ensureUserAndResetTrial } from "./fixtures";
import {
  isLocalSupabase,
  E2E_HANDOFF_H3_USER_ID,
  E2E_HANDOFF_H1_USER_ID,
  E2E_HANDOFF_H2_USER_ID,
} from "./env";

test.describe("Handoff resilience (H1–H3 fixes)", () => {
  test.beforeEach(async () => {
    test.skip(
      !isLocalSupabase(),
      "JWT bypass requires local Supabase"
    );
  });

  test("H3 — only one handoff API call despite React Strict Mode double-fire", async ({
    page,
    baseURL,
  }) => {
    await ensureUserAndResetTrial(
      E2E_HANDOFF_H3_USER_ID,
      "e2e-h3@example.com"
    );
    await setupAuthenticatedPage(page, E2E_HANDOFF_H3_USER_ID, baseURL);

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
    await page.waitForURL(/\/[0-9a-f-]{36}$/i, { timeout: 20_000 });

    // Give extra time for any stray duplicate calls to arrive
    await page.waitForTimeout(2_000);

    // The bootstrapCalledRef guard should prevent more than one handoff API call
    expect(
      handoffCalls.length,
      `Expected exactly 1 handoff call, got ${handoffCalls.length}: ${JSON.stringify(handoffCalls)}`
    ).toBe(1);
    expect(handoffCalls[0].status).toBe(201);
  });

  test("H1 — canvas save retries on transient failure and persists after retry", async ({
    page,
    baseURL,
  }) => {
    await ensureUserAndResetTrial(
      E2E_HANDOFF_H1_USER_ID,
      "e2e-h1@example.com"
    );
    await setupAuthenticatedPage(page, E2E_HANDOFF_H1_USER_ID, baseURL);

    // Intercept PUT /api/sessions/*/canvas: fail the first attempt, let retries through.
    let canvasPutCount = 0;
    await page.route("**/api/sessions/*/canvas", (route) => {
      if (route.request().method() !== "PUT") {
        void route.fallback();
        return;
      }
      canvasPutCount++;
      if (canvasPutCount === 1) {
        // Simulate a transient server error on the first attempt
        void route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Transient failure" }),
        });
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
      { timeout: 30_000 }
    );

    await page.goto("/");
    await page.waitForURL(/\/[0-9a-f-]{36}$/i, { timeout: 20_000 });

    await canvasSuccessPromise;

    // The retry mechanism should have sent at least 2 PUT requests
    expect(
      canvasPutCount,
      `Expected ≥2 canvas PUT attempts (1 failed + 1 succeeded), got ${canvasPutCount}`
    ).toBeGreaterThanOrEqual(2);

    // Verify canvas was actually persisted: reload and check node is visible
    await page.reload();
    await expect(
      page.locator(".react-flow__node").filter({ hasText: "Lambda" })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("H2 — transcript save retries on transient failure and persists", async ({
    page,
    baseURL,
  }) => {
    await ensureUserAndResetTrial(
      E2E_HANDOFF_H2_USER_ID,
      "e2e-h2@example.com"
    );
    await setupAuthenticatedPage(page, E2E_HANDOFF_H2_USER_ID, baseURL);

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
      { timeout: 30_000 }
    );

    await page.goto("/");
    await page.waitForURL(/\/[0-9a-f-]{36}$/i, { timeout: 20_000 });

    await batchSuccessPromise;

    // The retry mechanism should have sent at least 2 batch POST requests
    expect(
      batchPostCount,
      `Expected ≥2 transcript batch POST attempts (1 failed + 1 succeeded), got ${batchPostCount}`
    ).toBeGreaterThanOrEqual(2);
  });
});
