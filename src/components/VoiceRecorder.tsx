"use client";

import { apiFetch, isEmbedded } from "@/lib/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { EXAMPLE_UTTERANCES, EXAMPLE_UTTERANCES_EN, parseUtterance, spokenConfirmation } from "@/lib/nlu";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCIES, formatMoney, type CurrencyCode } from "@/lib/money";
import { categoryLabel } from "@/lib/categories";
import { toCivilDate } from "@/lib/utils";
import { useMicPermission, useSpeechOutput, useVoiceCapture } from "@/lib/speech";
import { Button, Card, Chip, Field, Select, TextArea, TextInput } from "./ui";
import { DatePickerField } from "./calendar";
import { IconCheck, IconMic, IconMicOff, IconVolume, IconVolumeOff, IconWave, IconX } from "./icons";
import { cn } from "@/lib/utils";

export interface PrefsLike {
  muteReplay: boolean;
  speakConfirmations: boolean;
  voiceUri: string | null;
  speechRate: number;
  speechPitch: number;
}

export function VoiceRecorder({
  prefs,
  budgetCurrency,
  onSaved,
}: {
  prefs: PrefsLike;
  budgetCurrency: string;
  onSaved?: () => void;
}) {
  const { t, isAr, locale, formatDate } = useI18n();
  const { state: micState, request: requestMic } = useMicPermission();
  const capture = useVoiceCapture({
    lang: isAr ? "ar-SY" : "en-US",
    // Fired once the recorder has flushed the final audio chunk — no timing guesswork.
    onAudio: (audio) => {
      audioMetaRef.current = audio;
      audioRef.current?.pause();
      audioRef.current = null;
      setLastAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        const bin = atob(audio.base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([bytes], { type: audio.mimeType }));
      });
    },
  });
  const { speak, cancel, speaking, arabicVoices } = useSpeechOutput();

  const [text, setText] = useState("");
  const [form, setForm] = useState({
    amount: "" as string,
    currency: budgetCurrency,
    category: "other",
    kind: "expense" as "expense" | "income",
    date: toCivilDate(new Date()),
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "error" } | null>(null);
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const parsedOnce = useRef(false);
  const audioMetaRef = useRef<{ base64: string; mimeType: string; durationMs: number } | null>(null);

  const today = useMemo(() => toCivilDate(new Date()), []);

  const runParse = useCallback(
    (raw: string) => {
      if (!raw.trim()) return;
      const parsed = parseUtterance(raw, { today, fallbackCurrency: (budgetCurrency as CurrencyCode) ?? "SYP_NEW" });
      setForm({
        amount: parsed.amount === null ? "" : String(parsed.amount),
        currency: parsed.currency ?? budgetCurrency,
        category: parsed.category,
        kind: parsed.kind,
        date: parsed.date,
        note: parsed.note || "",
      });
      parsedOnce.current = true;
    },
    [budgetCurrency, today],
  );

  // push live transcript into the send box
  useEffect(() => {
    const combined = `${capture.finalText}${capture.interimText ? ` ${capture.interimText}` : ""}`.trim();
    if (combined) setText(combined);
  }, [capture.finalText, capture.interimText]);

  // Live-parse every final chunk from the speech engine so the fields fill in while you talk.
  useEffect(() => {
    if (capture.finalText.trim()) runParse(capture.finalText);
  }, [capture.finalText, runParse]);

  const listening = capture.status === "listening" || capture.status === "requesting";

  /* ---- Embedded preview: the host frame may forbid the microphone ---- */
  const [embedded, setEmbedded] = useState(false);
  const [policyBlocked, setPolicyBlocked] = useState(false);
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);
  const [handoffBusy, setHandoffBusy] = useState(false);

  useEffect(() => {
    setEmbedded(isEmbedded());
    const doc = document as Document & {
      permissionsPolicy?: { allowsFeature: (feature: string) => boolean };
      featurePolicy?: { allowsFeature: (feature: string) => boolean };
    };
    const policy = doc.permissionsPolicy ?? doc.featurePolicy;
    try {
      if (policy && typeof policy.allowsFeature === "function") setPolicyBlocked(!policy.allowsFeature("microphone"));
    } catch {
      /* API not available — rely on the permission result instead */
    }
  }, []);

  async function openStandalone() {
    setHandoffBusy(true);
    // open synchronously inside the tap so popup blockers allow it
    const win = window.open("about:blank", "_blank");
    let url = `${window.location.origin}/sign-in`;
    try {
      const res = await apiFetch("/api/auth/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const data = (await res.json().catch(() => ({}))) as { code?: string };
      if (data.code) url = `${window.location.origin}/handoff#code=${encodeURIComponent(data.code)}`;
    } catch {
      /* fall back to the sign-in page */
    }
    if (win && !win.closed) win.location.href = url;
    else setHandoffUrl(url);
    setHandoffBusy(false);
  }

  const showStandalone = embedded && (policyBlocked || micState === "denied" || capture.status === "denied");

  async function handleMic() {
    if (listening) {
      capture.stop();
      return;
    }
    cancel();
    audioRef.current?.pause();
    if (micState === "denied" || micState === "prompt" || micState === "unsupported") {
      const next = await requestMic();
      if (next === "denied" || next === "unsupported") return;
    }
    parsedOnce.current = false;
    setForm((f) => ({ ...f, date: toCivilDate(new Date()) }));
    await capture.start();
  }

  async function handleSend() {
    if (!text.trim() || saving) return;
    setSaving(true);
    const parsed = parseUtterance(text, { today, fallbackCurrency: budgetCurrency as CurrencyCode });
    const amount = form.amount.trim() ? Number.parseFloat(form.amount) : parsed.amount;
    const audio = audioMetaRef.current;

    try {
      const res = await apiFetch("/api/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: text.trim(),
          audioBase64: audio?.base64 ?? null,
          mimeType: audio?.mimeType ?? null,
          durationMs: audio?.durationMs ?? null,
          amount: Number.isFinite(amount ?? Number.NaN) ? amount : null,
          currency: form.currency,
          category: form.category,
          kind: form.kind,
          date: form.date,
          note: form.note.trim() || null,
          save: Number.isFinite(amount ?? Number.NaN) && (amount ?? 0) > 0,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { code?: string } };
      if (!res.ok || !data.ok) {
        setToast({ msg: t(data.error?.code === "audioTooLarge" ? "errorGeneric" : "errorGeneric"), tone: "error" });
        setSaving(false);
        return;
      }

      const okAmount = Number.isFinite(amount ?? NaN) && (amount ?? 0) > 0;
      setToast({ msg: okAmount ? t("savedOk") : t("nothingDetected"), tone: okAmount ? "ok" : "error" });

      // Audio feedback respects the "mute replay after recording" preference.
      if (!prefs.muteReplay && prefs.speakConfirmations && okAmount) {
        const label = categoryLabel(form.category, locale);
        speak(
          spokenConfirmation(
            { ...parsed, amount: amount ?? null, kind: form.kind },
            formatMoney(amount ?? 0, form.currency, locale),
            label,
            locale,
          ),
          { voiceUri: prefs.voiceUri, rate: prefs.speechRate, pitch: prefs.speechPitch },
        );
      }

      setText("");
      audioMetaRef.current = null;
      audioRef.current?.pause();
      audioRef.current = null;
      setLastAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setForm({ amount: "", currency: budgetCurrency, category: "other", kind: "expense", date: toCivilDate(new Date()), note: "" });
      parsedOnce.current = false;
      capture.reset();
      window.dispatchEvent(new Event("sarfi:inbox-changed"));
      window.dispatchEvent(new Event("sarfi:transactions-changed"));
      onSaved?.();
    } catch {
      setToast({ msg: t("errorGeneric"), tone: "error" });
    }
    setSaving(false);
  }

  const banner =
    capture.status === "denied" || micState === "denied"
      ? { tone: "danger" as const, text: t("micDenied") }
      : capture.noSTT || capture.status === "unsupported"
        ? { tone: "warn" as const, text: t("micUnsupported") }
        : null;

  return (
    <div className="space-y-4">
      {/* Mic pad */}
      <Card className="relative overflow-hidden p-5">
        <div
          className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-500"
          style={{
            background: listening
              ? "radial-gradient(420px 220px at 50% 120%, rgba(61,220,151,0.28), transparent 70%)"
              : "radial-gradient(420px 200px at 50% 120%, rgba(61,220,151,0.1), transparent 70%)",
          }}
        />
        <div className="relative flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            {listening ? (
              <>
                <span className="absolute h-28 w-28 rounded-full bg-mint/20 animate-pulse-ring" />
                <span
                  className="absolute h-28 w-28 rounded-full bg-mint/25 transition-transform duration-100"
                  style={{ transform: `scale(${1 + capture.level * 0.35})` }}
                />
              </>
            ) : null}
            <button
              type="button"
              onClick={handleMic}
              aria-label={listening ? t("tapToStop") : t("tapToSpeak")}
              aria-pressed={listening}
              className={cn(
                "tap relative flex h-24 w-24 items-center justify-center rounded-full border text-[#06231a] shadow-[0_20px_50px_-20px_rgba(61,220,151,0.9)]",
                listening ? "border-danger/50 bg-danger text-white" : "border-mint/40 bg-mint",
              )}
            >
              {listening ? <IconX size={30} strokeWidth={2.4} /> : <IconMic size={34} strokeWidth={2} />}
            </button>
          </div>

          <div className="flex h-8 items-end gap-1" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span
                key={i}
                className={cn("w-1.5 rounded-full transition-all duration-100", listening ? "bg-mint" : "bg-line")}
                style={{
                  height: listening ? `${10 + Math.min(22, capture.level * 30 * (0.5 + ((i * 37) % 10) / 10))}px` : "8px",
                  opacity: listening ? 0.55 + capture.level * 0.45 : 0.6,
                }}
              />
            ))}
          </div>

          <p className="text-center text-sm font-semibold text-muted">
            {listening ? (
              <span className="inline-flex items-center gap-2 text-mint">
                <span className="h-2 w-2 rounded-full bg-danger animate-pulse" />
                {t("listening")}
              </span>
            ) : capture.status === "processing" ? (
              t("interim")
            ) : micState === "granted" ? (
              t("tapToSpeak")
            ) : (
              t("tapToSpeak")
            )}
          </p>

          {micState !== "granted" ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const s = await requestMic();
                if (s === "granted") setToast({ msg: t("micGrantedState"), tone: "ok" });
              }}
            >
              {micState === "denied" ? <IconMicOff size={16} /> : <IconMic size={16} />}
              {t("grantMic")}
            </Button>
          ) : null}
        </div>

        {prefs.muteReplay ? (
          <p className="relative mt-4 flex items-center justify-center gap-2 rounded-2xl border border-line-soft bg-canvas-2/60 px-3 py-2 text-center text-[11px] leading-relaxed text-faint">
            <IconVolumeOff size={14} className="text-muted" />
            {t("mutedNotice")}
          </p>
        ) : null}
      </Card>

      {banner ? (
        <div
          role="alert"
          className={cn(
            "flex items-start gap-2 rounded-2xl border px-4 py-3 text-[13px] leading-relaxed animate-fade-in",
            banner.tone === "danger" ? "border-danger/35 bg-danger/10 text-danger" : "border-gold/30 bg-gold/10 text-gold-soft",
          )}
        >
          <IconMicOff size={16} className="mt-0.5 shrink-0" />
          <span>{banner.text}</span>
        </div>
      ) : null}

      {showStandalone ? (
        <Card className="border-gold/30 p-4 animate-fade-up">
          <p className="text-[13px] leading-relaxed text-gold-soft">{t("openStandaloneHint")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="gold" size="sm" onClick={openStandalone} loading={handoffBusy}>
              <IconMic size={15} />
              {t("openStandalone")}
            </Button>
            {handoffUrl ? (
              <a
                href={handoffUrl}
                target="_blank"
                rel="noopener"
                className="tap text-[12px] font-bold text-mint underline underline-offset-4"
              >
                {t("tapIfBlocked")}
              </a>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* Send box */}
      <Card className="p-4">
        <Field label={t("transcriptLabel")} htmlFor="assistant-transcript" hint={capture.interimText ? t("interim") : undefined}>
          <TextArea
            id="assistant-transcript"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              if (!parsedOnce.current) runParse(text);
            }}
            placeholder={t("transcriptPlaceholder")}
            dir="auto"
            rows={3}
          />
        </Field>

        {lastAudioUrl && !prefs.muteReplay ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line-soft bg-canvas-2/60 px-3 py-2">
            <button
              type="button"
              onClick={() => {
                if (!audioRef.current) audioRef.current = new Audio(lastAudioUrl);
                if (audioRef.current.paused) void audioRef.current.play();
                else audioRef.current.pause();
              }}
              className="tap flex items-center gap-2 text-[13px] font-semibold text-mint"
            >
              <IconVolume size={16} />
              {t("listen")}
            </button>
            <span className="flex h-5 flex-1 items-end gap-0.5" aria-hidden="true">
              {Array.from({ length: 26 }).map((_, i) => (
                <span key={i} className="w-full rounded-full bg-mint/35" style={{ height: `${20 + ((i * 53) % 70)}%` }} />
              ))}
            </span>
          </div>
        ) : null}

        {/* parsed preview */}
        {text.trim() ? (
          <div className="mt-4 space-y-3 animate-fade-up">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("detectedAmount")}>
                <TextInput
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  inputMode="decimal"
                  dir="ltr"
                  placeholder="0"
                  className="num font-latin"
                />
              </Field>
              <Field label={t("detectedCategory")}>
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {locale === "ar" ? c.ar : c.en}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("budgetCurrencyLabel")}>
                <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {locale === "ar" ? c.ar : c.en}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("detectedDate")}>
                <DatePickerField value={form.date} onChange={(d) => setForm({ ...form, date: d })} label={t("detectedDate")} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("detectedKind")}>
                <div className="flex gap-2">
                  <Chip active={form.kind === "expense"} onClick={() => setForm({ ...form, kind: "expense" })}>
                    {t("kindExpense")}
                  </Chip>
                  <Chip active={form.kind === "income"} onClick={() => setForm({ ...form, kind: "income" })}>
                    {t("kindIncome")}
                  </Chip>
                </div>
              </Field>
              <div className="flex items-end justify-end pb-1">
                {form.amount ? (
                  <span className="num rounded-2xl border border-mint/25 bg-mint/10 px-3 py-1.5 text-sm font-bold text-mint-soft">
                    {formatMoney(Number(form.amount) || 0, form.currency, locale)}
                  </span>
                ) : null}
              </div>
            </div>
            <Field label={t("detectedNote")} htmlFor="assistant-note">
              <TextInput
                id="assistant-note"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                dir="auto"
                placeholder={isAr ? "روح على دمشق" : "Went to Damascus"}
              />
            </Field>
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          <Button size="lg" className="flex-1" onClick={handleSend} loading={saving} disabled={!text.trim()}>
            <IconWave size={18} />
            {t("send")}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => {
              setText("");
              audioMetaRef.current = null;
              capture.reset();
              parsedOnce.current = false;
            }}
            disabled={!text.trim()}
            aria-label={t("cancel")}
          >
            <IconX size={18} />
          </Button>
        </div>
      </Card>

      {/* examples */}
      <Card className="p-4">
        <p className="mb-2.5 flex items-center gap-2 text-[13px] font-bold text-faint">
          <IconWave size={15} className="text-mint" />
          {t("examplesTitle")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(isAr ? EXAMPLE_UTTERANCES : EXAMPLE_UTTERANCES_EN).map((ex) => (
            <Chip
              key={ex}
              onClick={() => {
                setText(ex);
                runParse(ex);
                parsedOnce.current = true;
              }}
            >
              {ex}
            </Chip>
          ))}
        </div>
      </Card>

      {/* speak test (only when replay is not muted) */}
      {!prefs.muteReplay ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line-soft bg-surface/70 px-4 py-3">
          <span className="text-[13px] text-muted">
            {speaking ? (isAr ? "عم نحكي..." : "Speaking...") : t("speakConfirmationNow")}
          </span>
          <div className="flex gap-2">
            {arabicVoices.length === 0 ? <span className="text-[11px] text-gold-soft">{t("noArabicVoice")}</span> : null}
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                speaking
                  ? cancel()
                  : speak(isAr ? "تمام، سجّلت خمسين ليره على المواصلات." : t("testText"), {
                      voiceUri: prefs.voiceUri,
                      rate: prefs.speechRate,
                      pitch: prefs.speechPitch,
                    })
              }
            >
              <IconVolume size={15} />
              {speaking ? t("cancel") : t("testVoice")}
            </Button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          className={cn(
            "fixed inset-x-4 bottom-28 z-[60] mx-auto flex max-w-md items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl glass animate-fade-up",
            toast.tone === "ok" ? "border-mint/40 text-mint-soft" : "border-danger/40 text-danger",
          )}
        >
          {toast.tone === "ok" ? <IconCheck size={16} /> : <IconX size={16} />}
          {toast.msg}
        </div>
      ) : null}
      <p className="sr-only">{formatDate(form.date)}</p>
    </div>
  );
}
