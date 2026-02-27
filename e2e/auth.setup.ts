/**
 * One-time auth setup for handoff e2e. Run:
 *   pnpm exec playwright test e2e/auth.setup.ts
 * Then complete sign-in in the browser (Google or GitHub). Auth state is saved to
 * e2e/.auth/user.json so anonymous-handoff-canvas.spec.ts can run with a logged-in user.
 */
import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_DIR = path.join(process.cwd(), "e2e", ".auth");
const AUTH_FILE = path.join(AUTH_DIR, "user.json");

test.describe.configure({ mode: "serial" });

test("save auth state after sign-in", async ({ page }) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  await page.goto("/");
  await page.getByRole("button", { name: /sign in with google/i }).click();

  await page.waitForURL(
    (url) => {
      const p = new URL(url).pathname;
      return p === "/" || /^\/[0-9a-f-]{36}$/i.test(p);
    },
    { timeout: 90_000 }
  );

  await page.context().storageState({ path: AUTH_FILE });
});
