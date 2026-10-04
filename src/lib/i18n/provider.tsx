"use client";

import { apiFetch } from "@/lib/api";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AR, EN, type DictKey } from "./dictionary";
import { formatMoney as fmtMoney, formatNumber as fmtNum, getCurrency } from "@/lib/money";
import { fromCivilDate } from "@/lib/utils";

export type Locale = "ar" | "en";

interface I18nValue {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (l: Locale) => void;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
  isAr: boolean;
  formatMoney: (amount: number, currency?: string) => string;
  formatNumber: (n: number, decimals?: number) => string;
  formatDate: (civil: string, opts?: { weekday?: boolean; relative?: boolean }) => string;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const dir: "rtl" | "ltr" = locale === "ar" ? "rtl" : "ltr";

  // Restore the language picked earlier — cookies can be blocked inside the preview iframe.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("sarfi_locale");
      if ((stored === "ar" || stored === "en") && stored !== initialLocale) setLocaleState(stored);
    } catch {
      /* storage unavailable */
    }
  }, [initialLocale]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dir;
    // Cookie so the server renders the right direction on first paint (iframe-safe attributes on HTTPS).
    const attrs = window.location.protocol === "https:" ? "samesite=none; secure; partitioned" : "samesite=lax";
    document.cookie = `locale=${locale}; path=/; max-age=31536000; ${attrs}`;
    try {
      window.localStorage.setItem("sarfi_locale", locale);
    } catch {
      /* storage unavailable */
    }
  }, [locale, dir]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void apiFetch("/api/prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    }).catch(() => undefined);
  }, []);

  const t = useCallback(
    (key: DictKey, vars?: Record<string, string | number>) => {
      const table = locale === "ar" ? AR : EN;
      let out: string = table[key] ?? AR[key] ?? String(key);
      if (vars) {
        for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
      }
      return out;
    },
    [locale],
  );

  const formatMoney = useCallback(
    (amount: number, currency = "SYP_NEW") => fmtMoney(amount, currency, locale),
    [locale],
  );

  const formatNumber = useCallback((n: number, decimals = 0) => fmtNum(n, locale, decimals), [locale]);

  const formatDate = useCallback(
    (civil: string, opts?: { weekday?: boolean; relative?: boolean }) => {
      if (!civil) return "";
      const d = fromCivilDate(civil);
      const todayStr = civilToday();
      if (opts?.relative) {
        if (civil === todayStr) return t("today");
        if (civil === shift(todayStr, -1)) return t("yesterday");
      }
      const loc = locale === "ar" ? "ar-SY-u-nu-latn-ca-gregory" : "en-GB";
      return new Intl.DateTimeFormat(loc, {
        day: "2-digit",
        month: "long",
        year: "numeric",
        weekday: opts?.weekday ? "long" : undefined,
        calendar: "gregory",
        numberingSystem: "latn",
      }).format(d);
    },
    [locale, t],
  );

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir,
      setLocale,
      t,
      isAr: locale === "ar",
      formatMoney,
      formatNumber,
      formatDate,
      // Syria's week starts on Saturday; English locales start on Monday.
      weekStartsOn: locale === "ar" ? 6 : 1,
    }),
    [locale, dir, setLocale, t, formatMoney, formatNumber, formatDate],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function civilToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

function shift(civil: string, days: number): string {
  const d = fromCivilDate(civil);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

export function currencyName(code: string, locale: Locale) {
  const def = getCurrency(code);
  return locale === "ar" ? def.ar : def.en;
}

export { AR, EN };
export type { DictKey };
