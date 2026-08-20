import { useCallback, createContext, useContext, useEffect, useState } from "react";
import { API_BASE, clearAuthToken, getAuthToken, setAuthToken } from "@/api";

const AuthContext = createContext(null);

const USER_KEY = "smartml_user";

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

  // Restore session on load.
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const token = getAuthToken();
      if (!token) {
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
        } else {
          clearAuthToken();
          if (!cancelled) setUser(null);
        }
      } catch {
        // Backend unreachable — keep the cached session for offline browsing.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    boot();
    return () => { cancelled = true; };
  }, [persistUser]);

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

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
