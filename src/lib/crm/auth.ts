/**
 * Authentication. With Supabase configured, users sign in with email/password
 * through GoTrue and their org / role / employee come from the `users` table.
 * Without Supabase the app runs in local demo mode: the "signed-in user" is an
 * employee picked in the profile menu (used to preview role permissions and the
 * technician app).
 */
import type { Role } from "./types";

export interface Session {
  userId: string;
  email: string;
  role: Role;
  employeeId?: string;
  orgId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  demo: boolean;
}

const KEY = "deltaline-crm-session";
let cached: Session | null | undefined;

export function getSession(): Session | null {
  if (cached !== undefined) return cached;
  try {
    cached = typeof localStorage !== "undefined" ? (JSON.parse(localStorage.getItem(KEY) ?? "null") as Session | null) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function setSession(s: Session | null) {
  cached = s;
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — keep in memory */
  }
}

export function demoSession(employeeId: string, role: Role, email: string): Session {
  return { userId: `demo-${employeeId}`, email, role, employeeId, demo: true };
}

/** Supabase email/password sign-in (GoTrue REST) + profile lookup. */
export async function signInWithPassword(url: string, key: string, email: string, password: string): Promise<Session> {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error_description ?? "Sign-in failed");
  const tok = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number; user: { id: string; email: string } };
  const prof = await fetch(`${url}/rest/v1/users?id=eq.${tok.user.id}&select=org_id,employee_id,role`, { headers: { apikey: key, Authorization: `Bearer ${tok.access_token}` } });
  const [p] = (await prof.json()) as { org_id: string; employee_id: string | null; role: Role }[];
  if (!p) throw new Error("This account is not linked to a company yet.");
  const s: Session = { userId: tok.user.id, email: tok.user.email, role: p.role, employeeId: p.employee_id ?? undefined, orgId: p.org_id, accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresAt: Date.now() + tok.expires_in * 1000, demo: false };
  setSession(s);
  return s;
}

export async function refreshSession(url: string, key: string): Promise<Session | null> {
  const s = getSession();
  if (!s?.refreshToken) return s;
  if (s.expiresAt && s.expiresAt - Date.now() > 120000) return s;
  const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: s.refreshToken }) });
  if (!res.ok) {
    setSession(null);
    return null;
  }
  const tok = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  const next = { ...s, accessToken: tok.access_token, refreshToken: tok.refresh_token, expiresAt: Date.now() + tok.expires_in * 1000 };
  setSession(next);
  return next;
}
