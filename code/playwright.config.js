// @ts-check
import { defineConfig } from "@playwright/test";

const PORT = process.env.PORT || 5173;
export const BASE_URL = `http://localhost:${PORT}`;
export const API_URL = process.env.API_URL || "http://localhost:8000/api";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 300000,
  expect: { timeout: 60000 },
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  globalSetup: "./tests/global-setup.js",
});
