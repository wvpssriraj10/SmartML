// @ts-check
import { test, expect } from "@playwright/test";
import { uploadFile } from "./helpers.js";

test.describe("Predict flow", () => {
  test("upload iris -> inspect -> start training -> results appear", async ({ page }) => {
    await page.goto("/");

    // Mode: predict (default selected via localStorage, but ensure we're on upload)
    await page.getByRole("button", { name: /Supervised learning/i }).click();
    await uploadFile(page);

    // Analyzing step auto-advances -> cleaning
    await page.getByRole("button", { name: /Continue to Configure/i }).waitFor({ timeout: 60000 });
    await page.getByRole("button", { name: /Continue to Configure/i }).click();

    // Inspection step
    await page.getByRole("button", { name: /Start Training/i }).waitFor({ timeout: 30000 });
    await expect(page.locator("text=/inspection quality|data quality|quality score/i").first()).toBeVisible();
    await page.getByRole("button", { name: /Start Training/i }).click();

    // Training step shows model cards
    await page.getByRole("heading", { name: /models/i }).first().waitFor({ timeout: 15000 });

    // Wait for results (leaderboard). Poll for champion card. Free tier training can take 2-3 min.
    await expect(page.getByText(/champion|took the crown|leaderboard|Best model/i).first()).toBeVisible({
      timeout: 300000,
    });

    // Results leaderboard rendered
    await expect(page.locator("text=/Logistic Regression|Random Forest|Decision Tree/i").first()).toBeVisible();
  });
});
