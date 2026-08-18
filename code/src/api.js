const LOCAL_API = "http://localhost:8000/api";

export const API_BASE = (import.meta.env.VITE_API_BASE || LOCAL_API).replace(/\/+$/, "");

const TOKEN_KEY = "smartml_token";

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function clearAuthToken() {
  setAuthToken(null);
}

/**
 * fetch() wrapper that attaches the bearer token to SmartML API requests.
 * External URLs (e.g. presigned S3 uploads) are passed through untouched.
 */
export async function apiFetch(url, options = {}) {
  const isApiUrl = typeof url === "string" && url.startsWith(API_BASE);
  const token = isApiUrl ? getAuthToken() : null;
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

/**
 * Installs a global fetch interceptor so every existing fetch() call in the
 * app automatically sends the bearer token for SmartML API requests.
 * Must be called once at app startup.
 */
export function installAuthInterceptor() {
  const originalFetch = window.fetch;
  window.fetch = (url, options = {}) => {
    const isApiUrl = typeof url === "string" && url.startsWith(API_BASE);
    const token = isApiUrl ? getAuthToken() : null;
    if (!token) return originalFetch(url, options);
    const headers = new Headers(options.headers || {});
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    return originalFetch(url, { ...options, headers });
  };
}

