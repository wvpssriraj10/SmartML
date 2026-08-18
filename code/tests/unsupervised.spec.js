// @ts-check
import { test, expect } from "./fixtures.js";
import { uploadFile } from "./helpers.js";

async function goToModeConfig(page, modeName, startButton) {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("smartml_mode", ""));
  await page.reload();
  await page.getByRole("button", { name: new RegExp(modeName, "i") }).click();
  await uploadFile(page);
  await page.getByRole("button", { name: /Continue to Configure/i }).click();
  await page.getByRole("button", { name: new RegExp(startButton, "i") }).waitFor({ timeout: 30000 });
}

test.describe("Explore (clustering) flow", () => {
  test("cluster iris -> results appear", async ({ page }) => {
    await goToModeConfig(page, "Clustering", "Find my groups");
    await page.getByRole("button", { name: /Find my groups/i }).click();

    // Cluster results step: "N groups found" heading
    await expect(page.getByRole("heading", { name: /groups found/i })).toBeVisible({ timeout: 180000 });
  });
});

test.describe("Detect (anomaly) flow", () => {
  test("anomaly scan iris -> results appear", async ({ page }) => {
    await goToModeConfig(page, "Detect anomalies", "Find unusual rows");
    await page.getByRole("button", { name: /Find unusual rows/i }).click();

    // Anomaly results step: "N unusual rows" heading + flagged stats
    await expect(page.getByRole("heading", { name: /unusual rows/i })).toBeVisible({ timeout: 180000 });
  });
});
