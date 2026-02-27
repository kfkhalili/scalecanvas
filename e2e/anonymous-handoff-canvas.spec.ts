import { test, expect, type Page } from "@playwright/test";

const ANONYMOUS_WORKSPACE_KEY = "scalecanvas-anonymous-workspace";

function nodeByLabel(page: Page, label: string) {
  return page.locator(".react-flow__node").filter({ hasText: label });
}

test.describe("Anonymous → trial handoff: canvas persisted", () => {
  test("after sign-in, anonymous canvas is saved to trial session and survives reload", async ({
    page,
  }) => {
    let firstPutBody: { nodes?: unknown[]; edges?: unknown[] } | null = null;
    await page.route("**/api/sessions/*/canvas", async (route) => {
      const req = route.request();
      if (req.method() === "PUT" && firstPutBody === null) {
        try {
          firstPutBody = req.postDataJSON();
        } catch {
          firstPutBody = {};
        }
      }
      await route.continue();
    });

    const anonymousWorkspace = {
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

    await page.addInitScript(
      ({ key, payload }) => {
        localStorage.setItem(key, payload);
      },
      { key: ANONYMOUS_WORKSPACE_KEY, payload: JSON.stringify(anonymousWorkspace) }
    );

    await page.goto("/");

    const signInVisible = await page
      .getByRole("button", { name: /sign in with google/i })
      .isVisible();
    if (signInVisible) {
      test.skip(true, "Auth state expired. Re-run: pnpm exec playwright test e2e/auth.setup.ts");
    }

    await page.waitForURL(/\/[0-9a-f-]{36}$/i, { timeout: 20_000 });

    await page.waitForRequest(
      (req) => req.method() === "PUT" && req.url().includes("/canvas"),
      { timeout: 15_000 }
    );
    expect(firstPutBody).not.toBeNull();
    expect(firstPutBody!.nodes?.length ?? 0).toBeGreaterThan(0);

    await expect(nodeByLabel(page, "Lambda")).toBeVisible({ timeout: 10_000 });

    await page.reload();

    await expect(nodeByLabel(page, "Lambda")).toBeVisible({ timeout: 10_000 });
  });
});
