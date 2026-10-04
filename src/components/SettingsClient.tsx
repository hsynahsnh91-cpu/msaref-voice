"use client";

import { apiFetch } from "@/lib/api";
import { useSession } from "./SessionProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { VERSION } from "@/lib/i18n/dictionary";
import { CURRENCIES, formatMoney, parseAmountInput } from "@/lib/money";
import { useMicPermission, useSpeechOutput, useSpeechVoices } from "@/lib/speech";
import { BrandMark } from "./Brand";
import { Button, Card, Chip, Field, SectionTitle, Select, Switch, TextInput } from "./ui";
import {
  IconCheck,
  IconGlobe,
  IconInfo,
  IconMic,
  IconShield,
  IconTrash,
  IconUser,
  IconVolume,
  IconVolumeOff,
  IconWallet,
  IconX,
} from "./icons";
import { cn } from "@/lib/utils";

export interface SettingsProps {
  user: { email: string; name: string | null; createdAt: string };
  prefs: {
    locale: string;
    muteReplay: boolean;
    speakConfirmations: boolean;
    voiceUri: string | null;
    speechRate: number;
    speechPitch: number;
  };
  budget: { amount: number | null; currency: string; cycleStartDay: number };
}

export function SettingsClient({ user, prefs: initialPrefs, budget }: SettingsProps) {
  const router = useRouter();
  const { t, isAr, locale, formatDate, setLocale } = useI18n();
  const { refresh, updatePrefs, signOut: sessionSignOut, reset: resetSession } = useSession();
  const { state: micState, request: requestMic } = useMicPermission();
  const { voices } = useSpeechVoices();
  const { speak, cancel, speaking } = useSpeechOutput();

  const [prefs, setPrefs] = useState(initialPrefs);
  const [amount, setAmount] = useState(budget.amount !== null ? String(budget.amount) : "");
  const [currency, setCurrency] = useState(budget.currency || "SYP_NEW");
  const [cycleDay, setCycleDay] = useState(budget.cycleStartDay || 1);
  const [toast, setToast] = useState<string | null>(null);
  const [busyBudget, setBusyBudget] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const pendingPatch = useRef<Partial<typeof prefs>>({});

  const persist = useCallback(
    (patch: Partial<typeof prefs>) => {
      setPrefs((prev) => ({ ...prev, ...patch }));
      // keep the shared session in sync so the assistant honours the new settings immediately
      updatePrefs(patch);
      pendingPatch.current = { ...pendingPatch.current, ...patch };
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        const body = pendingPatch.current;
        pendingPatch.current = {};
        void apiFetch("/api/prefs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
          .then((res) => setToast(res.ok ? t("savedPrefs") : t("errorGeneric")))
          .catch(() => setToast(t("errorGeneric")));
      }, 350);
    },
    [t, updatePrefs],
  );

  useEffect(() => () => cancel(), [cancel]);

  async function saveBudget(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseAmountInput(amount);
    if (!parsed || parsed <= 0) {
      setToast(t("budgetError"));
      return;
    }
    setBusyBudget(true);
    const res = await apiFetch("/api/budget", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parsed, currency, cycleStartDay: cycleDay }),
    });
    setBusyBudget(false);
    if (res.ok) {
      setToast(t("budgetUpdated"));
      await refresh();
    } else {
      setToast(t("errorGeneric"));
    }
  }

  async function signOut() {
    await sessionSignOut();
    router.replace("/sign-in");
  }

  async function wipe() {
    try {
      await apiFetch("/api/account", { method: "DELETE" });
    } finally {
      resetSession();
      router.replace("/sign-in");
    }
  }

  const micLabel =
    micState === "granted"
      ? t("micGrantedState")
      : micState === "denied"
        ? t("micDeniedState")
        : micState === "unsupported"
          ? t("micUnsupportedState")
          : t("micPromptState");

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Account */}
      <section>
        <SectionTitle>{t("sectionProfile")}</SectionTitle>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface-2 text-mint">
              <IconUser size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-ink">{user.name || (isAr ? "حسابي" : "My account")}</p>
              <p dir="ltr" className="truncate text-start text-[12px] text-faint font-latin">
                {user.email}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-faint">
            {t("accountCreated")}: <span className="num">{formatDate(user.createdAt.slice(0, 10))}</span>
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-faint">{t("dataNote")}</p>
        </Card>
      </section>

      {/* Budget */}
      <section>
        <SectionTitle>{t("sectionBudget")}</SectionTitle>
        <Card className="p-4">
          <form onSubmit={saveBudget} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("budgetAmountLabel")} htmlFor="set-amount">
                <TextInput
                  id="set-amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  dir="ltr"
                  className="num font-latin"
                />
              </Field>
              <Field label={t("budgetCurrencyLabel")} htmlFor="set-currency">
                <Select id="set-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {locale === "ar" ? c.ar : c.en}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label={t("budgetCycleLabel")} htmlFor="set-cycle">
              <Select id="set-cycle" value={String(cycleDay)} onChange={(e) => setCycleDay(Number(e.target.value))}>
                {Array.from({ length: 28 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-[11px] leading-relaxed text-faint">{t("budgetNote")}</p>
            {amount && parseAmountInput(amount) ? (
              <p className="num rounded-2xl border border-mint/25 bg-mint/10 px-3 py-2 text-sm font-bold text-mint-soft">
                {formatMoney(parseAmountInput(amount) ?? 0, currency, locale)}
              </p>
            ) : null}
            <Button type="submit" loading={busyBudget} className="w-full">
              <IconWallet size={16} />
              {t("changeBudget")}
            </Button>
          </form>
        </Card>
      </section>

      {/* Voice */}
      <section>
        <SectionTitle>{t("sectionVoice")}</SectionTitle>
        <Card className="divide-y divide-line-soft p-4">
          <Switch
            label={t("muteReplay")}
            description={t("muteReplayHint")}
            checked={prefs.muteReplay}
            onChange={(v) => {
              persist({ muteReplay: v, ...(v ? { speakConfirmations: false } : {}) });
              if (v) cancel();
            }}
          />
          <div className={cn("pt-3 transition-opacity", prefs.muteReplay && "pointer-events-none opacity-40")}>
            <Switch
              label={t("speakConfirmations")}
              description={t("speakConfirmationsHint")}
              checked={prefs.speakConfirmations && !prefs.muteReplay}
              onChange={(v) => persist({ speakConfirmations: v })}
            />
          </div>

          <div className="space-y-3 pt-4">
            <Field label={t("voiceLabel")} htmlFor="set-voice">
              <Select
                id="set-voice"
                value={prefs.voiceUri ?? ""}
                onChange={(e) => persist({ voiceUri: e.target.value || null })}
              >
                <option value="">{t("voiceDefault")}</option>
                {voices
                  .filter((v) => v.lang?.toLowerCase().startsWith("ar"))
                  .map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {`${v.name} — ${v.lang}${v.localService ? "" : " ☁"}`}
                    </option>
                  ))}
              </Select>
            </Field>

            <Field label={`${t("speechRate")} · ${prefs.speechRate.toFixed(2)}x`}>
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.05}
                value={prefs.speechRate}
                onChange={(e) => persist({ speechRate: Number(e.target.value) })}
                aria-label={t("speechRate")}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-mint"
              />
            </Field>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={prefs.muteReplay}
                onClick={() => (speaking ? cancel() : speak(t("testText"), { voiceUri: prefs.voiceUri, rate: prefs.speechRate }))}
              >
                {prefs.muteReplay ? <IconVolumeOff size={15} /> : <IconVolume size={15} />}
                {speaking ? t("cancel") : t("testVoice")}
              </Button>
              {voices.filter((v) => v.lang?.toLowerCase().startsWith("ar")).length === 0 ? (
                <span className="text-[11px] text-gold-soft">{t("noArabicVoice")}</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-4">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink">{t("micStatus")}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    micState === "granted" ? "bg-mint" : micState === "denied" ? "bg-danger" : "bg-gold",
                  )}
                />
                <span className={micState === "granted" ? "text-mint-soft" : micState === "denied" ? "text-danger" : "text-gold-soft"}>
                  {micLabel}
                </span>
              </p>
            </div>
            <Button
              size="sm"
              variant={micState === "granted" ? "ghost" : "secondary"}
              onClick={async () => {
                const s = await requestMic();
                setToast(s === "granted" ? t("micGrantedState") : s === "denied" ? t("micDenied") : t("micUnsupported"));
              }}
            >
              {micState === "granted" ? <IconCheck size={15} /> : <IconMic size={15} />}
              {t("grantMic")}
            </Button>
          </div>
        </Card>
      </section>

      {/* Language */}
      <section>
        <SectionTitle>{t("sectionLanguage")}</SectionTitle>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <IconGlobe size={20} className="text-mint" />
            <div className="flex flex-1 gap-2">
              <Chip active={locale === "ar"} onClick={() => setLocale("ar")} className="flex-1">
                العربية
              </Chip>
              <Chip active={locale === "en"} onClick={() => setLocale("en")} className="flex-1">
                English
              </Chip>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-faint">
            {isAr
              ? "التطبيق مصمّم بالعربي والإنجليزي: الاتجاه، التقويم، الأسبوع، والأرقام كلها بتتغيّر مع اللغة."
              : "The app is designed in both Arabic and English: direction, calendar, week start and numerals all follow the language."}
          </p>
        </Card>
      </section>

      {/* About */}
      <section>
        <SectionTitle>{t("sectionAbout")}</SectionTitle>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <BrandMark size={48} />
            <div>
              <p className="text-[15px] font-black text-ink">{t("appName")} · Sarfi</p>
              <p className="num text-[12px] text-faint">
                {t("versionLabel")} {VERSION}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">{t("aboutText")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/privacy"
              className="tap inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-[13px] font-semibold text-ink hover:border-mint/40"
            >
              <IconShield size={15} className="text-mint" />
              {t("privacyPolicy")}
            </Link>
            <button
              type="button"
              onClick={() => setConfirmWipe(true)}
              className="tap inline-flex h-9 items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 text-[13px] font-semibold text-danger"
            >
              <IconTrash size={15} />
              {t("deleteAllData")}
            </button>
          </div>
        </Card>

        {/* Credit */}
        <div className="mt-4 overflow-hidden rounded-3xl border border-mint/20 bg-gradient-to-br from-mint/12 via-surface to-surface p-5 text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] text-mint uppercase">
            {isAr ? "صُنع بحب" : "Made with care"}
          </p>
          <p className="mt-2 text-lg font-black text-ink">{t("madeBy")}</p>
          <p className="num mt-1 text-[12px] text-faint">
            Sarfi v{VERSION} · {isAr ? "الليرة السورية الجديدة" : "New Syrian Pound"}
          </p>
        </div>
      </section>

      <Button variant="secondary" className="w-full" onClick={signOut}>
        <IconX size={16} />
        {t("signOut")}
      </Button>

      {confirmWipe ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-5">
          <div className="absolute inset-0 bg-black/75 animate-fade-in" onClick={() => setConfirmWipe(false)} aria-hidden="true" />
          <Card className="relative z-10 w-full max-w-sm p-5 animate-pop">
            <div className="mb-3 flex items-center gap-2 text-danger">
              <IconInfo size={18} />
              <h3 className="text-base font-bold">{t("deleteAllData")}</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-muted">{t("deleteAllConfirm")}</p>
            <div className="mt-5 flex gap-2">
              <Button variant="danger" className="flex-1" onClick={wipe}>
                <IconTrash size={16} />
                {t("delete")}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmWipe(false)}>
                {t("cancel")}
              </Button>
            </div>
          </Card>
        </div>
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
