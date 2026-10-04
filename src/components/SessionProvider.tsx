"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiFetch, clearToken, getToken } from "@/lib/api";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface SessionBudget {
  amount: number;
  currency: string;
  cycleStartDay: number;
}

export interface SessionPrefs {
  locale: string;
  muteReplay: boolean;
  speakConfirmations: boolean;
  voiceUri: string | null;
  speechRate: number;
  speechPitch: number;
}

export interface SessionData {
  user: SessionUser;
  budget: SessionBudget | null;
  prefs: SessionPrefs;
}

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionValue {
  status: SessionStatus;
  data: SessionData | null;
  refresh: () => Promise<SessionData | null>;
  updatePrefs: (patch: Partial<SessionPrefs>) => void;
  signOut: () => Promise<void>;
  reset: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [data, setData] = useState<SessionData | null>(null);
  const seq = useRef(0);

  const refresh = useCallback(async (): Promise<SessionData | null> => {
    const mySeq = ++seq.current;
    const tokenAtRequest = getToken();
    try {
      const res = await apiFetch("/api/me");
      if (mySeq !== seq.current) return null; // a newer refresh superseded this one
      if (res.status === 401) {
        // Only drop the stored token if it is the one that was just rejected.
        if (tokenAtRequest && getToken() === tokenAtRequest) clearToken();
        setData(null);
        setStatus("unauthenticated");
        return null;
      }
      if (!res.ok) throw new Error(`me ${res.status}`);
      const json = (await res.json()) as { ok: boolean } & SessionData;
      const next: SessionData = { user: json.user, budget: json.budget, prefs: json.prefs };
      setData(next);
      setStatus("authenticated");
      return next;
    } catch {
      if (mySeq === seq.current) setStatus((s) => (s === "loading" ? "unauthenticated" : s));
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updatePrefs = useCallback((patch: Partial<SessionPrefs>) => {
    setData((prev) => (prev ? { ...prev, prefs: { ...prev.prefs, ...patch } } : prev));
  }, []);

  const reset = useCallback(() => {
    seq.current++;
    clearToken();
    setData(null);
    setStatus("unauthenticated");
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiFetch("/api/auth/sign-out", { method: "POST" });
    } catch {
      /* even offline, forget the local session */
    }
    reset();
  }, [reset]);

  const value = useMemo<SessionValue>(
    () => ({ status, data, refresh, updatePrefs, signOut, reset }),
    [status, data, refresh, updatePrefs, signOut, reset],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
