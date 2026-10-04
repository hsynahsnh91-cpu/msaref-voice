"use client";

import { apiFetch } from "@/lib/api";
import { useSession } from "./SessionProvider";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { CURRENCIES, getCurrency, parseAmountInput } from "@/lib/money";
import { Button, Card, Chip, Field, Select } from "./ui";
import { IconArrowRight, IconCheck, IconWallet } from "./icons";
import { cn } from "@/lib/utils";

const QUICK = [250, 500, 1000, 2500, 5000, 10000];

export function BudgetOnboarding({
  initialAmount,
  initialCurrency,
  initialCycleDay,
  firstName,
}: {
  initialAmount: number | null;
  initialCurrency: string;
  initialCycleDay: number;
  firstName?: string | null;
}) {
  const router = useRouter();
  const { t, locale, isAr, formatNumber } = useI18n();
  const { refresh } = useSession();
  const [amount, setAmount] = useState(initialAmount !== null ? String(initialAmount) : "");
  const [currency, setCurrency] = useState(initialCurrency || "SYP_NEW");
  const [cycleDay, setCycleDay] = useState(initialCycleDay || 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const def = getCurrency(currency);
  const parsed = parseAmountInput(amount);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!parsed || parsed <= 0) {
      setError(t("budgetError"));
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed, currency, cycleStartDay: cycleDay }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { code?: string } };
      if (!res.ok || !data.ok) {
        setError(t(data.error?.code === "budgetError" ? "budgetError" : "errorGeneric"));
        setBusy(false);
        return;
      }
      // Pull the fresh budget into the shared session before entering the app.
      await refresh();
      router.replace("/assistant");
    } catch {
      setError(t("errorGeneric"));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 pt-safe pb-10">
      <div className="mt-8 flex items-center gap-3 animate-fade-up">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-mint/30 bg-mint/12 text-mint">
          <IconWallet size={26} />
        </span>
        <div>
          <h1 className="text-[25px] leading-tight font-black text-ink">
            {firstName ? (isAr ? `أهلاً فيك، ${firstName}` : `Welcome, ${firstName}`) : isAr ? "أهلاً فيك" : "Welcome"}
          </h1>
          <p className="text-[13px] text-muted">{t("appTagline")}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted animate-fade-up">{t("budgetSubtitle")}</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Card className="card-grad p-5 animate-fade-up">
          <Field label={t("budgetTitle")} htmlFor="budget-amount" error={error}>
            <div className="relative">
              <input
                id="budget-amount"
                name="amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                dir="ltr"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                aria-describedby="budget-currency-hint"
                className="num h-20 w-full rounded-3xl border border-line bg-canvas-2/80 px-5 text-center text-4xl font-black text-ink placeholder:text-faint/50 focus:border-mint focus:outline-none font-latin"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs font-bold text-mint">
                {locale === "ar" ? def.ar : def.en}
              </span>
            </div>
          </Field>

          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {QUICK.map((q) => (
              <Chip key={q} active={parsed === q} onClick={() => setAmount(String(q))}>
                {formatNumber(q)}
              </Chip>
            ))}
          </div>

          {parsed && parsed > 0 ? (
            <p className="num mt-4 flex items-center justify-center gap-2 rounded-2xl border border-mint/25 bg-mint/10 px-3 py-2 text-center text-sm font-bold text-mint-soft animate-pop">
              <IconCheck size={16} />
              {`${t("budgetAmountLabel")}: ${parsed.toLocaleString(locale === "ar" ? "ar-SY-u-nu-latn" : "en-US", {
                maximumFractionDigits: 2,
              })} ${def.symbol}`}
            </p>
          ) : null}
        </Card>

        <Card className="p-5 space-y-4 animate-fade-up">
          <Field label={t("budgetCurrencyLabel")} htmlFor="budget-currency" hint={<span id="budget-currency-hint">{t("budgetNote")}</span>}>
            <Select id="budget-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {locale === "ar" ? `${c.ar} (${c.symbol})` : `${c.en} (${c.iso})`}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t("budgetCycleLabel")} htmlFor="budget-cycle">
            <Select id="budget-cycle" value={String(cycleDay)} onChange={(e) => setCycleDay(Number(e.target.value))}>
              {Array.from({ length: 28 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </Select>
          </Field>
        </Card>

        <Button type="submit" size="lg" loading={busy} className={cn("w-full text-base")} disabled={!parsed || parsed <= 0}>
          {t("budgetEnterApp")}
          <IconArrowRight size={18} className="rtl:rotate-180" />
        </Button>
      </form>
    </div>
  );
}
