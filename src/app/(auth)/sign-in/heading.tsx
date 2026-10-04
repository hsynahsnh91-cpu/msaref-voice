"use client";

import { useI18n } from "@/lib/i18n/provider";

export function AuthHeading({ mode }: { mode: "in" | "up" }) {
  const { t } = useI18n();
  return (
    <header className="animate-fade-up">
      <h1 className="text-[26px] leading-snug font-extrabold text-ink">
        {mode === "in" ? t("signInTitle") : t("signUpTitle")}
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{mode === "in" ? t("signInSubtitle") : t("signUpSubtitle")}</p>
    </header>
  );
}
