"use client";

import { apiFetch } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { categoryLabel, CATEGORIES } from "@/lib/categories";
import { CURRENCIES, formatMoney } from "@/lib/money";
import { toCivilDate } from "@/lib/utils";
import { Button, Card, Chip, EmptyState, Field, Modal, Select, Skeleton, TextInput } from "./ui";
import { DatePickerField } from "./calendar";
import { CategoryBadge } from "./ui";
import { IconCheck, IconInbox, IconPause, IconPlay, IconTrash, IconVolume, IconWave, IconX } from "./icons";
import { cn } from "@/lib/utils";

export interface RecordingDTO {
  id: string;
  transcript: string;
  status: string;
  durationMs: number | null;
  mimeType: string | null;
  hasAudio: boolean;
  parsedAmount: number | null;
  parsedCurrency: string | null;
  parsedCategory: string | null;
  parsedNote: string | null;
  parsedDate: string | null;
  parsedKind: string | null;
  transactionId: string | null;
  createdAt: string;
}

function relativeTime(iso: string, locale: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  const loc = locale === "ar" ? "ar-SY-u-nu-latn" : "en-GB";
  if (mins < 1) return locale === "ar" ? "هلأ" : "just now";
  if (mins < 60) return new Intl.RelativeTimeFormat(loc, { numeric: "auto" }).format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours < 24) return new Intl.RelativeTimeFormat(loc, { numeric: "auto" }).format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 30) return new Intl.RelativeTimeFormat(loc, { numeric: "auto" }).format(-days, "day");
  return new Intl.DateTimeFormat(loc, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

export function InboxClient({ initial, currency }: { initial: RecordingDTO[]; currency: string }) {
  const { t, locale, formatDate, isAr } = useI18n();
  const [items, setItems] = useState<RecordingDTO[]>(initial);
  const [loading, setLoading] = useState(true);
  const blobUrls = useRef(new Map<string, string>());
  const unlocked = useRef(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecordingDTO | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/recordings", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { recordings: RecordingDTO[] };
        setItems(data.recordings ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load the inbox as soon as the tab opens, and whenever a new recording is saved.
  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    window.addEventListener("sarfi:inbox-changed", handler);
    return () => window.removeEventListener("sarfi:inbox-changed", handler);
  }, [refresh]);

  useEffect(() => {
    const urls = blobUrls.current;
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  /** Audio is fetched with the session header (works inside iframes), then played from a blob URL. */
  async function audioUrlFor(id: string): Promise<string> {
    const cached = blobUrls.current.get(id);
    if (cached) return cached;
    const res = await apiFetch(`/api/recordings/${id}/audio`);
    if (!res.ok) throw new Error("noAudio");
    const url = URL.createObjectURL(await res.blob());
    blobUrls.current.set(id, url);
    return url;
  }

  function ensureAudioElement(): HTMLAudioElement {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audio.preload = "auto";
    audio.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    });
    audio.addEventListener("timeupdate", () => setProgress(audio.currentTime));
    audio.addEventListener("ended", () => {
      setPlayingId(null);
      setProgress(0);
    });
    audioRef.current = audio;
    return audio;
  }

  async function togglePlay(rec: RecordingDTO) {
    const audio = ensureAudioElement();
    if (playingId === rec.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    audio.pause();
    // iOS only lets audio play inside the tap itself — unlock the element synchronously first.
    if (!unlocked.current) {
      unlocked.current = true;
      audio.muted = true;
      audio.play().catch(() => undefined);
      audio.pause();
      audio.muted = false;
    }
    setProgress(0);
    setDuration(rec.durationMs ? rec.durationMs / 1000 : 0);
    setPlayingId(rec.id);
    try {
      audio.src = await audioUrlFor(rec.id);
      audio.currentTime = 0;
      await audio.play();
    } catch {
      setPlayingId(null);
      setToast(t("noAudio"));
    }
  }

  async function remove(rec: RecordingDTO) {
    setItems((prev) => prev.filter((r) => r.id !== rec.id));
    if (playingId === rec.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
    await apiFetch(`/api/recordings/${rec.id}`, { method: "DELETE" });
    setToast(t("deletedRecording"));
    window.dispatchEvent(new Event("sarfi:inbox-changed"));
  }

  async function quickSave(rec: RecordingDTO) {
    const res = await apiFetch(`/api/recordings/${rec.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { code?: string } };
    if (data.ok) {
      setItems((prev) => prev.map((r) => (r.id === rec.id ? { ...r, status: "saved" } : r)));
      setToast(t("savedOk"));
      window.dispatchEvent(new Event("sarfi:transactions-changed"));
      window.dispatchEvent(new Event("sarfi:inbox-changed"));
    } else {
      setEditing(rec);
    }
  }

  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={pendingCount > 0}>{`${t("pendingBadge")} · ${pendingCount}`}</Chip>
        <Chip onClick={() => void refresh()}>{loading ? t("loading") : isAr ? "تحديث" : "Refresh"}</Chip>
      </div>

      {items.length === 0 && !loading ? (
        <EmptyState icon={<IconInbox size={24} />} title={t("inboxEmpty")} subtitle={t("inboxSubtitle")} />
      ) : null}

      <div className="space-y-3">
        {(loading && items.length === 0 ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />) : null)}
        {items.map((rec, idx) => {
          const playing = playingId === rec.id;
          const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
          return (
            <Card
              key={rec.id}
              className="p-4 animate-fade-up"
              style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
            >
              <div className="flex items-start gap-3">
                <CategoryBadge category={rec.parsedCategory ?? "other"} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "num rounded-full border px-2 py-0.5 text-[11px] font-bold",
                        rec.status === "saved" ? "border-mint/30 bg-mint/10 text-mint-soft" : "border-gold/30 bg-gold/10 text-gold-soft",
                      )}
                    >
                      {rec.status === "saved" ? t("savedBadge") : t("pendingBadge")}
                    </span>
                    <span className="text-[11px] text-faint">{relativeTime(rec.createdAt, locale)}</span>
                    {rec.parsedAmount ? (
                      <span className="num text-sm font-extrabold text-ink">
                        {formatMoney(rec.parsedAmount, rec.parsedCurrency ?? currency, locale)}
                      </span>
                    ) : null}
                  </div>
                  <p dir="auto" className="mt-1.5 line-clamp-3 text-[15px] leading-relaxed text-ink/90">
                    {rec.transcript}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
                    {rec.parsedCategory ? <span>{categoryLabel(rec.parsedCategory, locale)}</span> : null}
                    {rec.parsedDate ? <span className="num">{formatDate(rec.parsedDate)}</span> : null}
                    {rec.parsedKind ? <span>{rec.parsedKind === "income" ? t("kindIncome") : t("kindExpense")}</span> : null}
                  </div>
                </div>
              </div>

              {/* Voice verification player — the point of the Inbox */}
              {rec.hasAudio ? (
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line-soft bg-canvas-2/70 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => void togglePlay(rec)}
                    aria-label={playing ? t("pause") : `${t("listen")}: ${rec.transcript.slice(0, 40)}`}
                    aria-pressed={playing}
                    className={cn(
                      "tap flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                      playing ? "border-danger/40 bg-danger/15 text-danger" : "border-mint/40 bg-mint/15 text-mint",
                    )}
                  >
                    {playing ? <IconPause size={17} /> : <IconPlay size={17} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex h-6 items-end gap-[2px]" aria-hidden="true">
                      {Array.from({ length: 34 }).map((_, i) => {
                        const on = pct > 0 && (i / 34) * 100 <= pct;
                        return (
                          <span
                            key={i}
                            className={cn("w-full rounded-full transition-colors duration-200", on ? "bg-mint" : "bg-surface-3")}
                            style={{ height: `${18 + ((i * 47) % 78)}%` }}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-faint">
                      <span className="num">{playing ? `${Math.floor(progress)}s / ${Math.floor(duration)}s` : t("listen")}</span>
                      {rec.durationMs ? <span className="num">{Math.round(rec.durationMs / 1000)}s</span> : null}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 flex items-center gap-2 text-[11px] text-faint">
                  <IconWave size={13} />
                  {t("noAudio")}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {rec.status === "pending" ? (
                  <>
                    <Button size="sm" onClick={() => void quickSave(rec)} disabled={!rec.parsedAmount}>
                      <IconCheck size={15} />
                      {t("saveAsExpense")}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(rec)}>
                      <IconWave size={15} />
                      {t("edit")}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(rec)}>
                    {t("edit")}
                  </Button>
                )}
                <Button size="sm" variant="danger" onClick={() => void remove(rec)} aria-label={t("delete")}>
                  <IconTrash size={15} />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {editing ? (
        <EditSheet
          rec={editing}
          currency={currency}
          onClose={() => setEditing(null)}
          onDone={(msg) => {
            setEditing(null);
            setToast(msg);
            void refresh();
            window.dispatchEvent(new Event("sarfi:inbox-changed"));
            window.dispatchEvent(new Event("sarfi:transactions-changed"));
          }}
        />
      ) : null}

      {toast ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-28 z-[60] mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl border border-mint/40 px-4 py-3 text-sm font-bold text-mint-soft shadow-2xl glass animate-fade-up"
        >
          <IconCheck size={16} />
          {toast}
          <button type="button" onClick={() => setToast(null)} aria-label={t("close")} className="tap ms-1 text-muted">
            <IconX size={15} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function EditSheet({
  rec,
  currency,
  onClose,
  onDone,
}: {
  rec: RecordingDTO;
  currency: string;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const { t, locale } = useI18n();
  const [amount, setAmount] = useState(rec.parsedAmount ? String(rec.parsedAmount) : "");
  const [cat, setCat] = useState(rec.parsedCategory ?? "other");
  const [cur, setCur] = useState(rec.parsedCurrency ?? currency);
  const [kind, setKind] = useState(rec.parsedKind === "income" ? "income" : "expense");
  const [date, setDate] = useState(rec.parsedDate ?? toCivilDate(new Date()));
  const [note, setNote] = useState(rec.parsedNote ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await apiFetch(`/api/recordings/${rec.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number.parseFloat(amount), currency: cur, category: cat, kind, date, note }),
    });
    setBusy(false);
    if (res.ok) onDone(t("savedOk"));
    else onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t("edit")}
      footer={
        <>
          <Button className="flex-1" onClick={save} loading={busy} disabled={!amount}>
            {t("saveTransaction")}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p dir="auto" className="rounded-2xl border border-line-soft bg-canvas-2/60 p-3 text-sm text-muted">
          {rec.transcript}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("amountLabel")}>
            <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" dir="ltr" className="num font-latin" />
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
              {CATEGORIES.map((c) => (
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
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} dir="auto" />
        </Field>
        <div className="flex gap-2">
          <Chip active={kind === "expense"} onClick={() => setKind("expense")}>
            {t("kindExpense")}
          </Chip>
          <Chip active={kind === "income"} onClick={() => setKind("income")}>
            {t("kindIncome")}
          </Chip>
        </div>
      </div>
    </Modal>
  );
}

export function InboxIcon() {
  return <IconVolume size={16} />;
}
