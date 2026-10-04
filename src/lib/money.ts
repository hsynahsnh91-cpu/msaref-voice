export type CurrencyCode = "SYP_NEW" | "SYP_OLD" | "USD" | "EUR" | "TRY" | "SAR";

export interface CurrencyDef {
  code: CurrencyCode;
  /** ISO-4217-ish code shown in reports */
  iso: string;
  symbol: string;
  decimals: number;
  ar: string;
  en: string;
  /** how many units of this currency equal 1 new Syrian pound */
  perNewSyp: number;
}

/**
 * The app's home currency is the NEW Syrian pound (post-redenomination, 1 new SYP = 100 old SYP,
 * in circulation since 1 January 2026). The old pound stays selectable so people can enter the
 * amounts they still say out loud and have them converted.
 */
export const CURRENCIES: CurrencyDef[] = [
  {
    code: "SYP_NEW",
    iso: "SYP",
    symbol: "ل.س",
    decimals: 2,
    ar: "الليرة السورية الجديدة",
    en: "New Syrian Pound",
    perNewSyp: 1,
  },
  {
    code: "SYP_OLD",
    iso: "SYP",
    symbol: "ل.س ق",
    decimals: 0,
    ar: "الليرة السورية القديمة",
    en: "Old Syrian Pound",
    perNewSyp: 100,
  },
  {
    code: "USD",
    iso: "USD",
    symbol: "$",
    decimals: 2,
    ar: "دولار أمريكي",
    en: "US Dollar",
    perNewSyp: 0,
  },
  {
    code: "EUR",
    iso: "EUR",
    symbol: "€",
    decimals: 2,
    ar: "يورو",
    en: "Euro",
    perNewSyp: 0,
  },
  {
    code: "TRY",
    iso: "TRY",
    symbol: "₺",
    decimals: 2,
    ar: "ليرة تركية",
    en: "Turkish Lira",
    perNewSyp: 0,
  },
  {
    code: "SAR",
    iso: "SAR",
    symbol: "ر.س",
    decimals: 2,
    ar: "ريال سعودي",
    en: "Saudi Riyal",
    perNewSyp: 0,
  },
];

export const DEFAULT_CURRENCY: CurrencyCode = "SYP_NEW";

export function getCurrency(code: string | null | undefined): CurrencyDef {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

function numberFormatter(locale: string, decimals: number) {
  // Latin digits even in Arabic: money must stay unambiguous.
  const loc = locale.startsWith("ar") ? "ar-SY-u-nu-latn" : "en-US";
  return new Intl.NumberFormat(loc, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatNumber(value: number, locale: string, decimals = 0) {
  if (!Number.isFinite(value)) value = 0;
  return numberFormatter(locale, decimals).format(value);
}

export function formatMoney(value: number, currency: string, locale: string, opts?: { withSymbol?: boolean }) {
  const def = getCurrency(currency);
  const decimals = def.decimals > 0 && Math.abs(value % 1) > 0.0001 ? def.decimals : 0;
  const num = numberFormatter(locale, decimals).format(Number.isFinite(value) ? value : 0);
  if (opts?.withSymbol === false) return num;
  return locale.startsWith("ar") ? `${num} ${def.symbol}` : `${num} ${def.iso === "SYP" ? "SYP" : def.iso}`;
}

/** Convert an amount into the new Syrian pound when a rate exists. */
export function toNewSyp(value: number, currency: string): number | null {
  const def = getCurrency(currency);
  if (!def.perNewSyp) return null;
  return value / def.perNewSyp;
}

export function convertAmount(value: number, from: string, to: string): number | null {
  const a = getCurrency(from);
  const b = getCurrency(to);
  if (!a.perNewSyp || !b.perNewSyp) return null;
  return (value / a.perNewSyp) * b.perNewSyp;
}

export function parseAmountInput(raw: string): number | null {
  const cleaned = raw
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[,\u066c\u066b\s]/g, ".")
    .replace(/[^0-9.]/g, "")
    .replace(/\.(?=[^.]*\.)/g, "");
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
