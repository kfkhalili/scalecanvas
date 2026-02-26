import { test, expect, type Page } from "@playwright/test";

/**
 * Seed localStorage with a canvas store snapshot before page scripts run.
 * Uses `addInitScript` which executes in the page context before any app JS,
 * so the Zustand persist middleware will pick it up during rehydration.
 */
async function seedCanvasStore(
  page: Page,
  nodes: unknown[],
  edges: unknown[] = [],
): Promise<void> {
  const payload = JSON.stringify({
    state: { nodes, edges, hasAttemptedEval: false },
    version: 0,
  });
  await page.addInitScript((data) => {
    localStorage.setItem("scalecanvas-canvas", data);
  }, payload);
}

const SINGLE_NODE = [
  {
    id: "pw-node-1",
    type: "awsLambda",
    position: { x: 250, y: 120 },
    data: { label: "PW Test Node" },
  },
];

const TWO_NODES = [
  {
    id: "pw-top",
    type: "awsApiGateway",
    position: { x: 250, y: 0 },
    data: { label: "Top Node" },
  },
  {
    id: "pw-bottom",
    type: "awsLambda",
    position: { x: 250, y: 200 },
    data: { label: "Bottom Node" },
  },
];

const ONE_EDGE = [
  {
    id: "pw-edge-1",
    source: "pw-top",
    target: "pw-bottom",
    sourceHandle: "bottom-out",
    targetHandle: "top",
  },
];

/** Locate a ReactFlow node by its visible label text. */
function nodeByLabel(page: Page, label: string) {
  return page.locator(".react-flow__node").filter({ hasText: label });
}

test.describe("Anonymous canvas persistence", () => {
  test("nodes survive a page refresh", async ({ page }) => {
    await seedCanvasStore(page, SINGLE_NODE);
    await page.goto("/");

    // Wait for the node to appear
    await expect(nodeByLabel(page, "PW Test Node")).toBeVisible({ timeout: 10_000 });

    // Refresh
    await page.reload();

    // Node must still be visible after reload (rehydrated from localStorage)
    await expect(nodeByLabel(page, "PW Test Node")).toBeVisible({ timeout: 10_000 });
  });

  test("edges survive a page refresh", async ({ page }) => {
    await seedCanvasStore(page, TWO_NODES, ONE_EDGE);
    await page.goto("/");

    await expect(nodeByLabel(page, "Top Node")).toBeVisible({ timeout: 10_000 });
    await expect(nodeByLabel(page, "Bottom Node")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".react-flow__edge")).toHaveCount(1, { timeout: 5_000 });

    await page.reload();

    await expect(nodeByLabel(page, "Top Node")).toBeVisible({ timeout: 10_000 });
    await expect(nodeByLabel(page, "Bottom Node")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".react-flow__edge")).toHaveCount(1, { timeout: 5_000 });
  });

  test("canvas does not crash on zoom after refresh", async ({ page }) => {
    await seedCanvasStore(page, SINGLE_NODE);
    await page.goto("/");

    await expect(nodeByLabel(page, "PW Test Node")).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(nodeByLabel(page, "PW Test Node")).toBeVisible({ timeout: 10_000 });

    // Zoom out with scroll
    const canvas = page.locator(".react-flow");
    await canvas.hover();
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 200);
    }

    // Should not crash — canvas and node should still be in the DOM
    await page.waitForTimeout(500);
    await expect(canvas).toBeVisible();
    await expect(nodeByLabel(page, "PW Test Node")).toBeAttached();
  });

  test("empty canvas stays empty on refresh (no phantom nodes)", async ({ page }) => {
    await page.goto("/");

    // No nodes initially
    await expect(page.locator(".react-flow__node")).toHaveCount(0, { timeout: 5_000 });

    await page.reload();

    // Still no nodes
    await expect(page.locator(".react-flow__node")).toHaveCount(0, { timeout: 5_000 });
  });
});
