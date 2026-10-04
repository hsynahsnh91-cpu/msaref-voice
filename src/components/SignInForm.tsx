"use client";

import { apiFetch, setToken } from "@/lib/api";
import { useSession } from "./SessionProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button, Field, TextInput } from "./ui";
import { IconApple, IconEye, IconEyeOff, IconGoogle, IconLock, IconMail, IconUser } from "./icons";
import { cn } from "@/lib/utils";

type Mode = "in" | "up";

const ERROR_KEYS = [
  "invalidCredentials",
  "emailTaken",
  "passwordTooShort",
  "passwordTooLong",
  "invalidEmail",
  "authFailed",
  "sessionFailed",
] as const;
type ErrorKey = (typeof ERROR_KEYS)[number];

export function SignInForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { t, isAr, locale } = useI18n();
  const { refresh } = useSession();
  const uid = useId();
  const emailId = `${uid}-email`;
  const passwordId = `${uid}-password`;
  const nameId = `${uid}-name`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Guarantee the canonical lowercase autocomplete tokens exist in the live DOM —
  // these are what password managers key on.
  useEffect(() => {
    emailRef.current?.setAttribute("autocomplete", "username");
    emailRef.current?.setAttribute("inputmode", "email");
    passwordRef.current?.setAttribute("autocomplete", mode === "up" ? "new-password" : "current-password");
  }, [mode]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await apiFetch(mode === "in" ? "/api/auth/sign-in" : "/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: mode === "up" ? name : undefined, locale }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        needsBudget?: boolean;
        token?: string;
        error?: { code?: string };
      };
      if (!res.ok || !data.ok) {
        const code = (data.error?.code ?? "authFailed") as ErrorKey;
        setError(ERROR_KEYS.includes(code) ? code : "authFailed");
        setBusy(false);
        return;
      }
      // Keep the session even where the browser drops cookies (cross-site preview iframe, Safari ITP).
      if (data.token) setToken(data.token);
      const session = await refresh();
      if (!session) {
        setError("sessionFailed");
        setBusy(false);
        return;
      }
      router.replace(session.budget ? "/assistant" : "/onboarding");
    } catch {
      setError("authFailed");
      setBusy(false);
    }
  }

  function federated(provider: "google" | "apple") {
    setNotice(t("federatedNote"));
    // Wire your own OAuth credentials here (Google Identity Services / Sign in with Apple JS).
    if (typeof window !== "undefined") {
      window.console.info(`[sarfi] federated sign-in pressed: ${provider}`);
    }
  }

  const passwordType = showPassword ? "text" : "password";

  return (
    <div className="w-full animate-fade-up">
      {/* Federated sign-in first, above the "or" divider */}
      <div className="grid gap-2.5">
        <Button type="button" variant="secondary" size="lg" onClick={() => federated("google")} className="font-semibold">
          <IconGoogle size={19} />
          Continue with Google
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={() => federated("apple")} className="font-semibold">
          <IconApple size={19} />
          Continue with Apple
        </Button>
      </div>

      {/* Sign-in method divider: thin rule with "or" in the middle */}
      <div role="separator" aria-label={t("or")} className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-line" />
        <span className="text-xs font-semibold tracking-wide text-faint">{isAr ? "أو" : t("or")}</span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-line" />
      </div>

      <form
        onSubmit={onSubmit}
        noValidate={false}
        aria-label="Sign in"
        className="space-y-4 rounded-3xl border border-line-soft bg-surface/70 p-5"
      >
        {mode === "up" ? (
          <Field label={t("name")} htmlFor={nameId}>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 flex items-center text-faint" style={{ insetInlineStart: "0.95rem" }}>
                <IconUser size={18} />
              </span>
              <TextInput
                id={nameId}
                name="name"
                type="text"
                autoComplete="name"
                inputMode="text"
                placeholder={isAr ? "أبو عمر" : "Your name"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="ps-11"
              />
            </div>
          </Field>
        ) : null}

        <Field label={t("email")} htmlFor={emailId} error={error === "invalidEmail" ? t("invalidEmail") : null}>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 flex items-center text-faint" style={{ insetInlineStart: "0.95rem" }}>
              <IconMail size={18} />
            </span>
            <TextInput
              ref={emailRef}
              id={emailId}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              required
              dir="ltr"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={error === "invalidEmail" || error === "emailTaken"}
              className="ps-11 text-start font-latin"
            />
          </div>
        </Field>

        <Field
          label={t("password")}
          htmlFor={passwordId}
          error={
            error === "passwordTooShort" || error === "passwordTooLong"
              ? t(error)
              : error === "invalidCredentials" && mode === "in"
                ? t("invalidCredentials")
                : null
          }
        >
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 flex items-center text-faint" style={{ insetInlineStart: "0.95rem" }}>
              <IconLock size={18} />
            </span>
            <TextInput
              ref={passwordRef}
              id={passwordId}
              name="password"
              type={passwordType}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              required
              minLength={mode === "up" ? 8 : undefined}
              dir="ltr"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={Boolean(error && error !== "emailTaken")}
              className="ps-11 pe-14 font-latin"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              title={showPassword ? "Hide password" : "Show password"}
              className="tap absolute inset-y-0 flex items-center text-muted hover:text-mint"
              style={{ insetInlineEnd: "0.85rem" }}
            >
              {showPassword ? <IconEyeOff size={19} /> : <IconEye size={19} />}
            </button>
          </div>
        </Field>

        {error === "emailTaken" || error === "authFailed" || error === "sessionFailed" ? (
          <p
            role="alert"
            className="rounded-2xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium leading-relaxed text-danger animate-fade-in"
          >
            {t(error)}
          </p>
        ) : null}

        <Button type="submit" size="lg" loading={busy} className="w-full">
          {busy ? t("submitting") : mode === "in" ? (isAr ? "تسجيل الدخول" : "Sign in") : t("createAccount")}
        </Button>

        {notice ? (
          <p className="rounded-2xl border border-gold/25 bg-gold/8 px-3 py-2 text-xs leading-relaxed text-gold-soft animate-fade-in">
            {notice}
          </p>
        ) : null}

        <p className={cn("pt-1 text-center text-[13px] text-faint")}>
          {mode === "in" ? (
            <>
              {t("noAccount")}{" "}
              <Link href="/sign-up" className="tap font-bold text-mint hover:text-mint-soft">
                {t("createAccount")}
              </Link>
            </>
          ) : (
            <>
              {t("haveAccount").split("?")[0]}؟{" "}
              <Link href="/sign-in" className="tap font-bold text-mint hover:text-mint-soft">
                {isAr ? "سجّل دخول" : "Sign in"}
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
