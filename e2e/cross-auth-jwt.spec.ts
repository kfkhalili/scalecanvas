import { test, expect } from "@playwright/test";
import { bypassOAuthAndInject, mintServiceRoleToken } from "./jwtBypass";
import { isLocalSupabase, E2E_JWT_BYPASS_USER_ID } from "./env";

test.describe("Cross-auth JWT bypass", () => {
  test.beforeEach(async () => {
    test.skip(
      !isLocalSupabase(),
      "JWT bypass requires local Supabase (NEXT_PUBLIC_SUPABASE_URL with 127.0.0.1 or localhost)"
    );

    // Ensure the bypass user exists (idempotent: 422 means already present).
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
    const serviceToken = mintServiceRoleToken();
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: serviceToken,
        Authorization: `Bearer ${serviceToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: E2E_JWT_BYPASS_USER_ID,
        email: "e2e-bypass@example.com",
        email_confirm: true,
        password: "e2e-dummy-password",
      }),
    });
    if (!res.ok && res.status !== 422) {
      throw new Error(`Admin user creation failed: ${res.status} ${res.statusText}`);
    }
  });

  test("clicking Google login with interceptor injects session and redirects to dashboard", async ({
    page,
    baseURL,
  }) => {
    await bypassOAuthAndInject(
      page,
      E2E_JWT_BYPASS_USER_ID,
      baseURL ?? "http://localhost:3000"
    );

    await page.goto("/");

    await page.waitForURL(
      (url) => {
        const path = new URL(url).pathname;
        return path === "/" || /^\/[0-9a-f-]{36}$/i.test(path);
      },
      { timeout: 15_000 }
    );

    const pathname = new URL(page.url()).pathname;
    const isRoot = pathname === "/";
    const isSessionPage = /^\/[0-9a-f-]{36}$/i.test(pathname);
    expect(isRoot || isSessionPage).toBe(true);

    await expect(
      page.getByRole("button", { name: /sign in with google/i })
    ).not.toBeVisible();
  });
});
