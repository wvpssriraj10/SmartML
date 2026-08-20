// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Auth", () => {
  test("app opens directly to the mode selector without a login screen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /What are you trying to/i })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: /Supervised learning/i })).toBeVisible();
    // No login form anywhere
    await expect(page.getByPlaceholder(/you@example\.com/)).toHaveCount(0);
  });

  test("session persists across a reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /What are you trying to/i })).toBeVisible({ timeout: 30000 });
    await page.reload();
    await expect(page.getByRole("heading", { name: /What are you trying to/i })).toBeVisible({ timeout: 30000 });
  });

  test("sign out shows a reconnect screen, not a login form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /What are you trying to/i })).toBeVisible({ timeout: 30000 });

    await page.getByRole("button", { name: /Sign out/i }).click();
    await expect(page.getByText(/Connecting to SmartML/i)).toBeVisible();
    await expect(page.getByPlaceholder(/you@example\.com/)).toHaveCount(0);

    // Retry reconnects the demo session.
    await page.getByRole("button", { name: /Retry/i }).click();
    await expect(page.getByRole("heading", { name: /What are you trying to/i })).toBeVisible({ timeout: 30000 });
  });
});