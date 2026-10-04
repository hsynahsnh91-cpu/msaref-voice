"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { BrandMark } from "./Brand";
import { LocaleSwitch } from "./LocaleSwitch";
import { formatMoney } from "@/lib/money";
import { IconWallet } from "./icons";

export function AppHeader({
  name,
  email,
  budgetAmount,
  budgetCurrency,
}: {
  name: string | null;
  email: string;
  budgetAmount: number | null;
  budgetCurrency: string;
}) {
  const { t, isAr, locale } = useI18n();
  const firstName = (name || email.split("@")[0] || "").split(" ")[0];

  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-line-soft glass px-4 pt-safe">
      <div className="flex items-center justify-between gap-3 py-3">
        <Link href="/assistant" className="tap flex items-center gap-2.5">
          <BrandMark size={40} />
          <span className="leading-tight">
            <span className="block text-[15px] font-black tracking-tight text-ink">{t("appName")}</span>
            <span className="block text-[11px] font-medium text-faint">
              {isAr ? `أهلاً، ${firstName}` : `Hi, ${firstName}`}
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {budgetAmount !== null ? (
            <Link
              href="/settings"
              className="tap num hidden items-center gap-1.5 rounded-full border border-mint/25 bg-mint/10 px-3 py-1.5 text-[12px] font-bold text-mint-soft sm:inline-flex"
            >
              <IconWallet size={14} />
              {formatMoney(budgetAmount, budgetCurrency, locale)}
            </Link>
          ) : null}
          <LocaleSwitch compact />
        </div>
      </div>
    </header>
  );
}
