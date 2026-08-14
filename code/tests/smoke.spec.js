// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Smoke", () => {
  test("app loads and mode selector renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /What are you trying to/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Supervised learning/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Clustering/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Detect anomalies/i })).toBeVisible();
  });

  test("theme toggle switches dark to light", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("smartml_theme", "dark"));
    await page.reload();
    const toggle = page.getByRole("button", { name: /theme/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator("html")).toHaveClass(/light/);
    await toggle.click();
    await expect(page.locator("html")).not.toHaveClass(/light/);
  });
});
