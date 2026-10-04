"use client";

/**
 * Client-side session token storage + fetch wrapper.
 * The httpOnly cookie is still set by the server, but cross-site iframes
 * (the preview panel) and Safari ITP may drop it — so every API call also
 * sends `Authorization: Bearer <token>`.
 */

const KEY = "sarfi_session";
let memoryToken: string | null = null;

function safeStorage(kind: "local" | "session"): Storage | null {
  try {
    const s = kind === "local" ? window.localStorage : window.sessionStorage;
    const probe = "__sarfi_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  if (memoryToken) return memoryToken;
  const fromLocal = safeStorage("local")?.getItem(KEY) ?? null;
  const fromSession = fromLocal ? null : (safeStorage("session")?.getItem(KEY) ?? null);
  memoryToken = fromLocal ?? fromSession;
  return memoryToken;
}

export function setToken(token: string) {
  memoryToken = token;
  if (typeof window === "undefined") return;
  const local = safeStorage("local");
  if (local) local.setItem(KEY, token);
  else safeStorage("session")?.setItem(KEY, token);
}

export function clearToken() {
  memoryToken = null;
  if (typeof window === "undefined") return;
  safeStorage("local")?.removeItem(KEY);
  safeStorage("session")?.removeItem(KEY);
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token && !headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
    cache: init.cache ?? "no-store",
  });
}

export function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}
