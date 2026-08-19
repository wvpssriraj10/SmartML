// @ts-check
import { expect } from "@playwright/test";
import { API_URL } from "../playwright.config.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const IRIS_PATH = path.resolve(__dirname, "../../test_iris.csv");

/** Upload a file through the drop zone by setting the hidden file input. */
export async function uploadFile(page, filePath = IRIS_PATH) {
  await page.setInputFiles('input[type="file"]', filePath);
  await Promise.race([
    page.getByText("Upload complete").waitFor({ timeout: 30000 }),
    page.getByRole("button", { name: /Continue to Configure/i }).waitFor({ timeout: 60000 }),
  ]);
  await page.waitForLoadState("networkidle");
}

/** Poll a backend job until done; returns final status. */
export async function waitForJobDone(api, jobId, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await fetch(`${api}/status/${jobId}`);
    const data = await r.json();
    if (data.status === "completed") return data;
    if (data.status === "failed") throw new Error(`Job ${jobId} failed: ${data.message || "unknown"}`);
    await new Promise((res) => setTimeout(res, 1500));
  }
  throw new Error(`Job ${jobId} timed out`);
}

/** Run the full predictable flow and return the uploaded dataset id. */
export async function completePredictFlow(page, { testInfo }) {
  // Mode selector -> predict
  await page.getByRole("button", { name: /Supervised learning/i }).click();
  await page.waitForURL("**/", { timeout: 10000 });
  await uploadFile(page);

  // Cleaning step -> Continue
  await page.getByRole("button", { name: /Continue|Next|Let's clean|Proceed/i }).first().waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /Continue|Next|Let's clean|Proceed/i }).first().click();
  await page.waitForTimeout(500);

  // Inspection step shows target
  await page.getByText(/target|Target/i).first().waitFor({ timeout: 30000 });

  // Start training
  await page.getByRole("button", { name: /Start training|Train|Run models/i }).first().click();
  return page;
}

export { expect, API_URL };
