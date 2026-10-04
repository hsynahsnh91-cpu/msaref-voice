"use client";

import { apiFetch } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { CURRENCIES, formatMoney, type CurrencyCode } from "@/lib/money";
import { addCivilDays, cn, toCivilDate } from "@/lib/utils";
import { Button, Card, CategoryBadge, Chip, EmptyState, Field, Modal, Select, Skeleton, TextInput, KindIcon } from "./ui";
import { DateRangePicker, DatePickerField, type CivilRange } from "./calendar";
import { IconPlus, IconReceipt, IconSearch, IconTrash, IconWallet, IconX } from "./icons";

export interface TransactionDTO {
  id: string;
  occurredOn: string;
  amount: number;
  currency: string;
  kind: string;
  category: string;
  note: string | null;
  source: string;
  createdAt: string;
}

export interface TxSummary {
  spent: number;
  income: number;
  unconverted: number;
  count: number;
  perCategory: Record<string, number>;
}

function cycleRange(cycleStartDay: number): CivilRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), cycleStartDay);
  if (start > now) start.setMonth(start.getMonth() - 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, cycleStartDay - 1 || 1);
  return { from: toCivilDate(start), to: toCivilDate(end) };
}

export function TransactionsClient({
  initial,
  summary: initialSummary,
  budgetAmount,
  budgetCurrency,
  cycleStartDay,
}: {
  initial: TransactionDTO[];
  summary: TxSummary;
  budgetAmount: number | null;
  budgetCurrency: string;
  cycleStartDay: number;
}) {
  const { t, locale, isAr, formatDate, formatMoney: fmt } = useI18n();
  const [rows, setRows] = useState<TransactionDTO[]>(initial);
  const [summary, setSummary] = useState<TxSummary>(initialSummary);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("");
  const [range, setRange] = useState<CivilRange>(() => cycleRange(cycleStartDay));
  const [preset, setPreset] = useState<string | null>("cycle");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const today = useMemo(() => toCivilDate(new Date()), []);

  const presets = useMemo(
    () => [
      { key: "cycle", label: isAr ? "دورة الميزانية" : "Budget cycle", range: cycleRange(cycleStartDay) },
      { key: "today", label: t("today"), range: { from: today, to: today } },
      { key: "7", label: t("last7"), range: { from: addCivilDays(today, -6), to: today } },
      { key: "30", label: t("last30"), range: { from: addCivilDays(today, -29), to: today } },
      {
        key: "month",
        label: t("thisMonth"),
        range: { from: toCivilDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), to: today },
      },
      { key: "all", label: t("allTime"), range: null },
    ],
    [cycleStartDay, isAr, t, today],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      if (category) params.set("category", category);
      if (q.trim()) params.set("q", q.trim());
      const res = await apiFetch(`/api/transactions?${params.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { transactions: TransactionDTO[]; summary: TxSummary };
        setRows(data.transactions ?? []);
        setSummary(data.summary);
      }
    } finally {
      setLoading(false);
    }
  }, [category, q, range.from, range.to]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 220);
    return () => window.clearTimeout(id);
  }, [load]);

  useEffect(() => {
    const handler = () => void load();
    window.addEventListener("sarfi:transactions-changed", handler);
    return () => window.removeEventListener("sarfi:transactions-changed", handler);
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, TransactionDTO[]>();
    for (const r of rows) {
      const list = map.get(r.occurredOn) ?? [];
      list.push(r);
      map.set(r.occurredOn, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows]);

  const budgetPct = budgetAmount && budgetAmount > 0 ? Math.min(100, (summary.spent / budgetAmount) * 100) : 0;
  const remaining = budgetAmount !== null ? budgetAmount - summary.spent : null;
  const topCategories = useMemo(
    () => Object.entries(summary.perCategory).sort((a, b) => b[1] - a[1]).slice(0, 4),
    [summary.perCategory],
  );

  async function remove(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await apiFetch(`/api/transactions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setToast(t("deleteTransaction"));
    void load();
  }

  return (
    <div className="space-y-4">
      {/* Budget overview */}
      <Card className="card-grad p-5 animate-fade-up">
        <div className="flex items-center gap-4">
          <BudgetRing pct={budgetPct} over={budgetAmount !== null && summary.spent > budgetAmount} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-wide text-faint uppercase">{t("budgetUsed")}</p>
            <p className="num text-2xl font-extrabold text-ink">{fmt(summary.spent, budgetCurrency)}</p>
            {budgetAmount !== null ? (
              <p className={cn("num mt-0.5 text-[13px] font-semibold", remaining !== null && remaining < 0 ? "text-danger" : "text-mint-soft")}>
                {remaining !== null && remaining < 0 ? `${t("overBudget")} · ` : `${t("remaining")}: `}
                {fmt(Math.abs(remaining ?? 0), budgetCurrency)}
              </p>
            ) : (
              <p className="mt-0.5 text-[13px] text-faint">{t("budgetSubtitle")}</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label={t("totalIncome")} value={fmt(summary.income, budgetCurrency)} tone="income" />
          <Stat label={t("transactionsCount")} value={String(summary.count)} tone="muted" />
        </div>

        {topCategories.length ? (
          <div className="mt-4 space-y-2">
            {topCategories.map(([cat, value]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-[11px] font-semibold text-muted">{categoryLabel(cat, locale)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-mint-deep to-mint transition-all duration-700"
                    style={{ width: `${Math.min(100, (value / Math.max(summary.spent, 1)) * 100)}%` }}
                  />
                </span>
                <span className="num w-20 shrink-0 text-end text-[11px] font-bold text-ink">{formatMoney(value, budgetCurrency, locale)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <span className="pointer-events-none absolute inset-y-0 flex items-center text-faint" style={{ insetInlineStart: "0.8rem" }}>
            <IconSearch size={16} />
          </span>
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-10 ps-10 text-[13px]"
            aria-label={t("searchPlaceholder")}
          />
        </div>
        <DateRangePicker
          value={range}
          activePreset={preset}
          onChange={(r) => {
            setRange(r);
            const match = presets.find((p) => p.range?.from === r.from && p.range?.to === r.to);
            setPreset(match ? match.key : r.from ? null : "all");
          }}
          presets={presets}
        />
        <Button size="sm" variant="secondary" className="h-10" onClick={() => setAdding(true)}>
          <IconPlus size={16} />
          {t("addManual")}
        </Button>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <Chip active={category === ""} onClick={() => setCategory("")}>
          {t("allCategories")}
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
            {locale === "ar" ? c.ar : c.en}
          </Chip>
        ))}
      </div>

      {(preset || category || q) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setPreset(null);
            setCategory("");
            setQ("");
            setRange(cycleRange(cycleStartDay));
            setPreset("cycle");
          }}
        >
          <IconX size={14} />
          {t("clearFilters")}
        </Button>
      )}

      {/* List */}
      {rows.length === 0 ? (
        loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <EmptyState icon={<IconReceipt size={24} />} title={t("noResults")} subtitle={t("transactionsSubtitle")} />
        )
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, list]) => (
            <div key={day} className="animate-fade-up">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <h3 className="text-[13px] font-bold text-muted">{formatDate(day, { weekday: true, relative: true })}</h3>
                <span className="num text-[12px] font-bold text-faint">
                  {fmt(
                    list.reduce((acc, r) => acc + (r.kind === "income" ? 0 : r.amount), 0),
                    budgetCurrency,
                  )}
                </span>
              </div>
              <Card className="divide-y divide-line-soft overflow-hidden p-0">
                {list.map((r) => (
                  <div key={r.id} className="tap tap-soft group flex items-center gap-3 px-3 py-3 hover:bg-surface-2/60">
                    <CategoryBadge category={r.category} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">
                        {r.note?.trim() || categoryLabel(r.category, locale)}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
                        <span className={r.kind === "income" ? "text-income" : "text-muted"}>
                          <KindIcon kind={r.kind} />
                        </span>
                        {categoryLabel(r.category, locale)}
                        {r.source === "voice" ? <span className="rounded-full border border-mint/25 px-1.5 text-[9px] text-mint-soft">voice</span> : null}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "num shrink-0 text-[15px] font-extrabold",
                        r.kind === "income" ? "text-income" : "text-ink",
                      )}
                    >
                      {r.kind === "income" ? "+" : "−"}
                      {formatMoney(r.amount, r.currency, locale)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void remove(r.id)}
                      aria-label={t("deleteTransaction")}
                      className="tap rounded-xl p-2 text-faint opacity-60 hover:bg-danger/10 hover:text-danger focus:opacity-100 group-hover:opacity-100"
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <AddSheet
          currency={budgetCurrency as CurrencyCode}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            setToast(t("savedOk"));
            void load();
            window.dispatchEvent(new Event("sarfi:inbox-changed"));
          }}
        />
      ) : null}

      {toast ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-28 z-[60] mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl border border-mint/40 px-4 py-3 text-sm font-bold text-mint-soft shadow-2xl glass animate-fade-up"
        >
          {toast}
          <button type="button" onClick={() => setToast(null)} aria-label={t("close")} className="tap ms-1 text-muted">
            <IconX size={15} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "income" | "muted" }) {
  return (
    <div className="rounded-2xl border border-line-soft bg-canvas-2/60 px-3 py-2">
      <p className="text-[10px] font-bold tracking-wide text-faint uppercase">{label}</p>
      <p className={cn("num text-[15px] font-extrabold", tone === "income" ? "text-income" : "text-ink")}>{value}</p>
    </div>
  );
}

export function BudgetRing({ pct, over }: { pct: number; over?: boolean }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 72 72" className="h-20 w-20 -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" className="text-surface-3" strokeWidth="7" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="currentColor"
          className={cn("transition-all duration-700", over ? "text-danger" : "text-mint")}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (clamped / 100) * c}
        />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-[13px] font-extrabold text-ink">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

function AddSheet({ currency, onClose, onDone }: { currency: CurrencyCode; onClose: () => void; onDone: () => void }) {
  const { t, locale } = useI18n();
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState<string>("food");
  const [cur, setCur] = useState<string>(currency);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [date, setDate] = useState(toCivilDate(new Date()));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number.parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setBusy(true);
    const res = await apiFetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: value, currency: cur, category: cat, kind, occurredOn: date, note: note.trim() || null, source: "manual" }),
    });
    setBusy(false);
    if (res.ok) onDone();
    else onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("addManual")}
      footer={
        <Button type="submit" form="add-tx-form" className="flex-1" loading={busy}>
          <IconWallet size={16} />
          {t("saveTransaction")}
        </Button>
      }
    >
      <form id="add-tx-form" onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("amountLabel")}>
            <TextInput
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              dir="ltr"
              required
              placeholder="0"
              className="num font-latin"
            />
          </Field>
          <Field label={t("budgetCurrencyLabel")}>
            <Select value={cur} onChange={(e) => setCur(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {locale === "ar" ? c.ar : c.en}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("categoryLabel")}>
            <Select value={cat} onChange={(e) => setCat(e.target.value)}>
              {CATEGORIES.filter((c) => (kind === "income" ? c.id === "income" : c.id !== "income")).map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === "ar" ? c.ar : c.en}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("dateLabel")}>
            <DatePickerField value={date} onChange={setDate} label={t("dateLabel")} />
          </Field>
        </div>
        <Field label={t("noteLabel")}>
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} dir="auto" placeholder={t("transcriptPlaceholder")} />
        </Field>
        <div className="flex gap-2">
          <Chip active={kind === "expense"} onClick={() => setKind("expense")}>
            {t("kindExpense")}
          </Chip>
          <Chip active={kind === "income"} onClick={() => setKind("income")}>
            {t("kindIncome")}
          </Chip>
        </div>
      </form>
    </Modal>
  );
}
