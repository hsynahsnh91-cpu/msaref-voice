"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { DictKey } from "@/lib/i18n/dictionary";

export function PageHeader({
  titleKey,
  subtitleKey,
  right,
}: {
  titleKey: DictKey;
  subtitleKey?: DictKey;
  right?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-[24px] leading-tight font-black tracking-tight text-ink">{t(titleKey)}</h1>
        {subtitleKey ? <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted">{t(subtitleKey)}</p> : null}
      </div>
      {right}
    </div>
  );
}
