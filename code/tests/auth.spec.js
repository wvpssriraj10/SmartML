// @ts-check
import { test, expect } from "@playwright/test";
import { API_URL } from "../playwright.config.js";

test.describe("Auth", () => {
  test("unauthenticated users see the login screen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /SmartML/i })).toBeVisible();
    await expect(page.locator("form").getByRole("button", { name: /^Sign in$/i })).toBeVisible();
    await expect(page.getByPlaceholder(/you@example\.com/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Supervised learning/i })).toHaveCount(0);
  });

  test("register then use the app", async ({ page }) => {
    const email = `e2e_${Date.now()}@example.com`;
    const password = "testpassword123";

    await page.goto("/");
    await page.getByRole("button", { name: /^Create account$/i }).click();
    await page.getByPlaceholder(/Ada Lovelace/).fill("E2E Tester");
    await page.getByPlaceholder(/you@example\.com/).fill(email);
    await page.getByPlaceholder(/At least 6 characters/).fill(password);
    await page.locator("form").getByRole("button", { name: /^Create account$/i }).click();

    // Lands on the mode selector after registration
    await expect(page.getByRole("heading", { name: /What are you trying to/i })).toBeVisible({ timeout: 30000 });

    // Logout returns to login screen
    await page.getByRole("button", { name: /Sign out/i }).click();
    await expect(page.locator("form").getByRole("button", { name: /^Sign in$/i })).toBeVisible();

    // Login with the same credentials works
    await page.getByPlaceholder(/you@example\.com/).fill(email);
    await page.getByPlaceholder(/At least 6 characters/).fill(password);
    await page.locator("form").getByRole("button", { name: /^Sign in$/i }).click();
    await expect(page.getByRole("heading", { name: /What are you trying to/i })).toBeVisible({ timeout: 30000 });
  });

  test("wrong password shows an error", async ({ page }) => {
    const email = `e2e_${Date.now()}@example.com`;
    // Register
    await page.goto("/");
    await page.getByRole("button", { name: /^Create account$/i }).click();
    await page.getByPlaceholder(/you@example\.com/).fill(email);
    await page.getByPlaceholder(/At least 6 characters/).fill("testpassword123");
    await page.locator("form").getByRole("button", { name: /^Create account$/i }).click();
    await expect(page.getByRole("heading", { name: /What are you trying to/i })).toBeVisible({ timeout: 30000 });

    // Log out
    await page.getByRole("button", { name: /Sign out/i }).click();
    await expect(page.locator("form").getByRole("button", { name: /^Sign in$/i })).toBeVisible();

    // Wrong password
    await page.getByPlaceholder(/you@example\.com/).fill(email);
    await page.getByPlaceholder(/At least 6 characters/).fill("wrongpassword");
    await page.locator("form").getByRole("button", { name: /^Sign in$/i }).click();
    await expect(page.getByText(/Invalid email or password/i)).toBeVisible({ timeout: 30000 });
  });
});
