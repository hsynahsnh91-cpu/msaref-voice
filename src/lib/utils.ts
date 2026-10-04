import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function isServer() {
  return typeof window === "undefined";
}

/** Civil date helpers — always yyyy-mm-dd strings, never UTC-shifted Date objects. */
export function toCivilDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromCivilDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addCivilDays(s: string, days: number): string {
  const d = fromCivilDate(s);
  d.setDate(d.getDate() + days);
  return toCivilDate(d);
}

export function isValidCivilDate(s: string | undefined | null): s is string {
  if (!s) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromCivilDate(s).getTime());
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
