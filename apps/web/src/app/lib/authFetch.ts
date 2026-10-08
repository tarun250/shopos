// Authenticated fetch for standalone pages (invoice/label printing) opened in their own tab.
// Uses the session the main app stored in localStorage and renews it once on 401.

export const API_BASE = 'http://localhost:3001';

async function refresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem('shopos_refresh');
  if (!refreshToken) return null;
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const session = await res.json();
  localStorage.setItem('shopos_token', session.accessToken);
  localStorage.setItem('shopos_refresh', session.refreshToken);
  return session.accessToken;
}

export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const call = (token: string | null) =>
    fetch(`${API_BASE}${path}`, { ...init, headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const res = await call(localStorage.getItem('shopos_token'));
  if (res.status !== 401) return res;
  const token = await refresh();
  return token ? call(token) : res;
}

export const formatInr = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
