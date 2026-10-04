"use client";

import { useI18n, type Locale } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { IconGlobe } from "./icons";

export function LocaleSwitch({ compact }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  const options: { id: Locale; label: string }[] = [
    { id: "ar", label: t("languageAr") },
    { id: "en", label: t("languageEn") },
  ];
  return (
    <div
      role="group"
      aria-label={locale === "ar" ? "اللغة" : "Language"}
      className={cn("inline-flex items-center gap-1 rounded-full border border-line bg-surface-2/80 p-1", compact && "scale-95")}
    >
      <IconGlobe size={15} className="mx-1 text-faint" />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setLocale(o.id)}
          aria-pressed={locale === o.id}
          className={cn(
            "tap rounded-full px-3 py-1 text-[12px] font-bold transition-colors",
            locale === o.id ? "bg-mint text-[#06231a]" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
