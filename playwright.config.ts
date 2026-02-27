import * as fs from "fs";
import { defineConfig, devices } from "@playwright/test";

const authFile = "e2e/.auth/user.json";

/**
 * Playwright E2E test configuration.
 * Run `pnpm exec playwright test` after installing with:
 *   pnpm add -D @playwright/test
 *   pnpm exec playwright install --with-deps chromium
 *
 * Anonymous → trial handoff test requires auth state. Create it once with:
 *   pnpm exec playwright test e2e/auth.setup.ts
 * then complete sign-in in the browser. After that, the handoff test runs when
 * you run the full suite (project "anonymous-handoff" is added when authFile exists).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/anonymous-handoff-canvas\.spec\.ts/],
    },
    ...(fs.existsSync(authFile)
      ? [
          {
            name: "anonymous-handoff",
            use: {
              ...devices["Desktop Chrome"],
              storageState: authFile,
            },
            testMatch: /anonymous-handoff-canvas\.spec\.ts/,
          },
        ]
      : []),
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
