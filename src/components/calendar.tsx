"use client";

import { useCallback, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ar, enGB } from "date-fns/locale";
import { useI18n } from "@/lib/i18n/provider";
import { Popover } from "./popover";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "./icons";
import { cn, fromCivilDate, toCivilDate } from "@/lib/utils";
import { Button, Chip } from "./ui";

export interface CivilRange {
  from?: string;
  to?: string;
}

function useCalLocale() {
  const { locale, weekStartsOn } = useI18n();
  return useMemo(
    () => ({ locale: locale === "ar" ? ar : enGB, weekStartsOn, loc: locale === "ar" ? "ar-SY-u-nu-latn-ca-gregory" : "en-GB" }),
    [locale, weekStartsOn],
  );
}

function captionFormatter(loc: string) {
  const f = new Intl.DateTimeFormat(loc, { month: "long", year: "numeric", calendar: "gregory", numberingSystem: "latn" });
  return (d: Date) => f.format(d);
}

function MonthHeader({
  month,
  onPrev,
  onNext,
  label,
}: {
  month: Date;
  onPrev: () => void;
  onNext: () => void;
  label: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <button type="button" onClick={onPrev} aria-label="Previous month" className="tap rounded-xl border border-line bg-surface-2 p-1.5 text-muted hover:text-ink">
        <IconChevronLeft size={18} className="rtl:hidden" />
        <IconChevronRight size={18} className="hidden rtl:block" />
      </button>
      <span className="text-sm font-bold text-ink">{label}</span>
      <button type="button" onClick={onNext} aria-label="Next month" className="tap rounded-xl border border-line bg-surface-2 p-1.5 text-muted hover:text-ink">
        <IconChevronRight size={18} className="rtl:hidden" />
        <IconChevronLeft size={18} className="hidden rtl:block" />
      </button>
    </div>
  );
}

/** Single civil date picker (Popover + DayPicker). */
export function DatePickerField({
  value,
  onChange,
  label,
  id,
  buttonClassName,
}: {
  value: string;
  onChange: (civil: string) => void;
  label: string;
  id?: string;
  buttonClassName?: string;
}) {
  const { locale } = useI18n();
  const { locale: calLocale, weekStartsOn, loc } = useCalLocale();
  const [month, setMonth] = useState<Date>(() => fromCivilDate(value || toCivilDate(new Date())));
  const format = captionFormatter(loc);
  const dayFormat = useMemo(() => new Intl.DateTimeFormat(loc, { day: "2-digit", month: "short", year: "numeric" }), [loc]);

  return (
    <Popover
      label={label}
      align="start"
      trigger={({ toggle, ref }) => (
        <button
          id={id}
          ref={ref}
          type="button"
          onClick={toggle}
          className={cn(
            "tap flex h-12 w-full items-center justify-between gap-2 rounded-2xl border border-line bg-canvas-2/80 px-4 text-[15px] text-ink hover:border-mint/50",
            buttonClassName,
          )}
        >
          <span className="num">{value ? dayFormat.format(fromCivilDate(value)) : "—"}</span>
          <IconCalendar size={18} className="text-mint" />
        </button>
      )}
    >
      {(close) => (
        <div className="w-[19rem]">
          <MonthHeader
            month={month}
            label={format(month)}
            onPrev={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            onNext={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          />
          <DayPicker
            mode="single"
            locale={calLocale}
            weekStartsOn={weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6}
            month={month}
            onMonthChange={setMonth}
            selected={value ? fromCivilDate(value) : undefined}
            onSelect={(d) => {
              if (d) {
                onChange(toCivilDate(d));
                close();
              }
            }}
            showOutsideDays
            fixedWeeks
            hideNavigation
            formatters={{ formatCaption: () => format(month) }}
          />
        </div>
      )}
    </Popover>
  );
}

/** Range picker: start/end get range_start / range_end, the days between get range_middle. */
export function DateRangePicker({
  value,
  onChange,
  presets,
  activePreset,
  className,
}: {
  value: CivilRange;
  onChange: (r: CivilRange) => void;
  presets?: { key: string; label: string; range: CivilRange | null }[];
  activePreset?: string | null;
  className?: string;
}) {
  const { locale, formatDate } = useI18n();
  const { locale: calLocale, weekStartsOn, loc } = useCalLocale();
  const today = toCivilDate(new Date());
  const [month, setMonth] = useState<Date>(() => fromCivilDate(value.from ?? today));
  const [open, setOpen] = useState(false);
  const format = captionFormatter(loc);

  const selected = useMemo(
    () => (value.from ? { from: fromCivilDate(value.from), to: value.to ? fromCivilDate(value.to) : undefined } : undefined),
    [value.from, value.to],
  );

  const handleSelect = useCallback(
    (range: { from?: Date; to?: Date } | undefined) => {
      if (!range?.from) {
        onChange({});
        return;
      }
      onChange({ from: toCivilDate(range.from), to: range.to ? toCivilDate(range.to) : undefined });
    },
    [onChange],
  );

  const label = value.from
    ? value.to && value.to !== value.from
      ? `${formatDate(value.from)} — ${formatDate(value.to)}`
      : formatDate(value.from)
    : locale === "ar"
      ? "كل الأوقات"
      : "All time";

  return (
    <Popover
      label="Date range"
      align="start"
      open={open}
      onOpenChange={setOpen}
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={cn(
            "tap flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold",
            value.from ? "border-mint/50 bg-mint/12 text-mint-soft" : "border-line bg-surface-2 text-muted",
            className,
          )}
        >
          <IconCalendar size={16} />
          <span className="num">{label}</span>
        </button>
      )}
    >
      {(close) => (
        <div className="w-[21rem] max-w-[calc(100vw-2rem)]">
          {presets?.length ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <Chip
                  key={p.key}
                  active={activePreset === p.key}
                  onClick={() => {
                    onChange(p.range ?? {});
                    if (p.range?.from) setMonth(fromCivilDate(p.range.from));
                    if (!p.range) close();
                  }}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
          ) : null}
          <MonthHeader
            month={month}
            label={format(month)}
            onPrev={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            onNext={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          />
          <DayPicker
            mode="range"
            locale={calLocale}
            weekStartsOn={weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6}
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={handleSelect}
            numberOfMonths={1}
            showOutsideDays
            fixedWeeks
            hideNavigation
            formatters={{ formatCaption: () => format(month) }}
          />
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line-soft pt-2">
            <span className="num text-xs text-faint">
              {value.from ? `${formatDate(value.from)}${value.to ? ` → ${formatDate(value.to)}` : ""}` : "—"}
            </span>
            <Button size="sm" onClick={close}>
              {locale === "ar" ? "تم" : "Done"}
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
}
