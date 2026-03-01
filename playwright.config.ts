import * as fs from "fs";
import * as path from "path";
import { defineConfig, devices } from "@playwright/test";

// Load .env.local so e2e JWT bypass uses same Supabase URL (and cookie name) as the app
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(__dirname, ".env.local"));

/**
 * Playwright E2E test configuration.
 * Run `pnpm exec playwright test` after installing with:
 *   pnpm add -D @playwright/test
 *   pnpm exec playwright install --with-deps chromium
 *
 * All auth in e2e uses JWT bypass (no manual sign-in). Cross-auth specs require local Supabase.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /\.spec\.ts$/,
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
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
