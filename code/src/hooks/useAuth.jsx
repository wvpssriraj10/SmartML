import { useCallback, createContext, useContext, useEffect, useState } from "react";
import { API_BASE, clearAuthToken, getAuthToken, setAuthToken } from "@/api";

const AuthContext = createContext(null);

const USER_KEY = "smartml_user";

// Shared demo account used to open the app without a login screen.
const DEMO_EMAIL = "demo@smartml.local";
const DEMO_PASSWORD = "smartml-demo-123";
const DEMO_NAME = "Demo User";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistUser = useCallback((u) => {
    setUser(u);
    try {
      if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
      else localStorage.removeItem(USER_KEY);
    } catch {}
  }, []);

  // POST form data and safely parse the JSON response so a missing/invalid
  // body can never surface as an opaque TypeError (e.g. "reading 'json'").
  const postForm = useCallback(async (url, body) => {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch {
      throw new Error("Could not reach the server. Please try again.");
    }
    let data = {};
    try {
      if (res) data = await res.json();
    } catch {
      data = {};
    }
    return { res, data };
  }, []);

  // Silently log into (or create) the shared demo account. Returns true when
  // a working session was established.
  const ensureDemoSession = useCallback(async () => {
    let { res, data } = await postForm(
      `${API_BASE}/auth/login`,
      new URLSearchParams({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
    );
    if (res && res.ok && data.token && data.user) {
      setAuthToken(data.token);
      persistUser(data.user);
      return true;
    }
    // First run — create the demo account.
    ({ res, data } = await postForm(
      `${API_BASE}/auth/register`,
      new URLSearchParams({ email: DEMO_EMAIL, password: DEMO_PASSWORD, display_name: DEMO_NAME })
    ));
    if (res && res.ok && data.token && data.user) {
      setAuthToken(data.token);
      persistUser(data.user);
      return true;
    }
    return false;
  }, [postForm, persistUser]);

  // Restore (or auto-create) a session on load — no login screen.
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const token = getAuthToken();
      if (!token) {
        if (!cancelled) await ensureDemoSession();
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const saved = localStorage.getItem(USER_KEY);
        if (saved) {
          const u = JSON.parse(saved);
          if (!cancelled) setUser(u);
        }
        let res;
        try {
          res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        } catch {
          res = null;
        }
        if (res && res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled && data.user) persistUser(data.user);
        } else if (res) {
          // Server reachable but token invalid — fall back to the demo session.
          clearAuthToken();
          if (!cancelled) await ensureDemoSession();
        } else {
          // Backend unreachable — keep the cached session for offline browsing.
        }
      } catch {
        // Backend unreachable — keep the cached session for offline browsing.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    boot();
    return () => { cancelled = true; };
  }, [ensureDemoSession, persistUser]);

  const login = useCallback(async (email, password) => {
    const { res, data } = await postForm(
      `${API_BASE}/auth/login`,
      new URLSearchParams({ email, password })
    );
    if (!res || !res.ok) throw new Error(data.detail || "Login failed");
    if (!data.token || !data.user) throw new Error("Unexpected response from server.");
    setAuthToken(data.token);
    persistUser(data.user);
    return data.user;
  }, [postForm, persistUser]);

  const register = useCallback(async (email, password, displayName) => {
    const body = new URLSearchParams({ email, password });
    if (displayName) body.append("display_name", displayName);
    const { res, data } = await postForm(`${API_BASE}/auth/register`, body);
    if (!res || !res.ok) throw new Error(data.detail || "Registration failed");
    if (!data.token || !data.user) throw new Error("Unexpected response from server.");
    setAuthToken(data.token);
    persistUser(data.user);
    return data.user;
  }, [postForm, persistUser]);

  const logout = useCallback(() => {
    clearAuthToken();
    persistUser(null);
  }, [persistUser]);

  // Retry establishing the demo session (e.g. after the backend comes up).
  const reconnect = useCallback(async () => {
    setLoading(true);
    await ensureDemoSession();
    setLoading(false);
  }, [ensureDemoSession]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, reconnect, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}