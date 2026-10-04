"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch, setToken } from "@/lib/api";
import { useSession } from "@/components/SessionProvider";
import { Splash } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n/provider";
import { BrandMark } from "@/components/Brand";

/** Receives a one-time code from the embedded preview and opens the same account here. */
export default function HandoffPage() {
  const router = useRouter();
  const { refresh } = useSession();
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const code = params.get("code");
    // never leave the code in the address bar / history
    window.history.replaceState(null, "", "/handoff");
    if (!code) {
      setFailed(true);
      return;
    }
    void (async () => {
      try {
        const res = await apiFetch("/api/auth/handoff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "exchange", code }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; token?: string; needsBudget?: boolean };
        if (!res.ok || !data.ok || !data.token) {
          setFailed(true);
          return;
        }
        setToken(data.token);
        await refresh();
        router.replace(data.needsBudget ? "/onboarding" : "/assistant");
      } catch {
        setFailed(true);
      }
    })();
  }, [refresh, router]);

  if (!failed) return <Splash label={t("handoffWorking")} />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center animate-fade-up">
      <BrandMark size={64} />
      <p className="text-sm leading-relaxed text-muted">{t("handoffFailed")}</p>
      <Link
        href="/sign-in"
        className="tap inline-flex h-11 items-center rounded-2xl bg-mint px-5 text-sm font-bold text-[#06231a]"
      >
        {t("signInAr")}
      </Link>
    </main>
  );
}
