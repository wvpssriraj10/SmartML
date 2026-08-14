// @ts-check
import { API_URL, BASE_URL } from "../playwright.config.js";

export default async function globalSetup() {
  const baseCheck = await fetch(`${BASE_URL}`).catch(() => null);
  if (!baseCheck || !baseCheck.ok) {
    throw new Error(`Frontend not reachable at ${BASE_URL}. Start it with: npm run dev (in code/)`);
  }
  const apiCheck = await fetch(`${API_URL}/health`).catch(() => null);
  if (!apiCheck || !apiCheck.ok) {
    throw new Error(`Backend not reachable at ${API_URL}/health. Start it with: python -m backend.main`);
  }
  console.log(`[setup] FE ${BASE_URL} ok, BE ${API_URL}/health ok`);
}
