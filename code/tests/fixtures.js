// @ts-check
import { test as base, expect } from "@playwright/test";
import { API_URL } from "../playwright.config.js";

// One account per worker (Playwright runs 1 worker here), seeded before any test.
let authReady = null;

async function ensureAuth() {
  if (authReady) return authReady;
  const email = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password: "testpassword123", display_name: "E2E Tester" }),
  });
  if (!res.ok) {
    throw new Error(`Failed to register E2E test user: ${res.status}`);
  }
  const { token, user } = await res.json();
  authReady = { token, user };
  return authReady;
}

export const test = base.extend({
  page: async ({ page }, use) => {
    const { token, user } = await ensureAuth();
    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem("smartml_token", token);
        localStorage.setItem("smartml_user", JSON.stringify(user));
      },
      { token, user },
    );
    await use(page);
  },
});

export { expect };