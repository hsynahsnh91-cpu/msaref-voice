"use client";

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import {
  IconCheck,
  IconExpense,
  IconIncome,
  IconLoader,
  IconMic,
  IconReceipt,
  IconShield,
  IconSparkle,
  IconWallet,
  IconWave,
  IconX,
  type IconProps,
} from "./icons";
import type { CategoryId } from "@/lib/categories";

/* ------------------------------- Button ------------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-mint text-[#06231a] font-bold shadow-[0_10px_30px_-12px_rgba(61,220,151,0.85)] hover:bg-mint-soft",
  secondary: "bg-surface-2 text-ink border border-line hover:border-mint/50 hover:bg-surface-3",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-surface-2",
  danger: "bg-danger/12 text-danger border border-danger/30 hover:bg-danger/20",
  gold: "bg-gold text-[#2a1c02] font-bold hover:bg-gold-soft",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px] rounded-xl gap-1.5",
  md: "h-11 px-4 text-sm rounded-2xl gap-2",
  lg: "h-13 px-5 text-base rounded-2xl gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "tap inline-flex select-none items-center justify-center whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-55",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading ? <IconLoader size={18} /> : null}
      {children}
    </button>
  );
}

/* -------------------------------- Card -------------------------------- */

export function Card({
  className,
  children,
  as: Tag = "div",
  ...rest
}: { className?: string; children: ReactNode; as?: "div" | "section" | "article" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag {...rest} className={cn("rounded-3xl border border-line-soft bg-surface/90 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.9)]", className)}>
      {children}
    </Tag>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-bold tracking-wide text-faint uppercase">{children}</h2>
      {hint ? <span className="text-xs text-faint">{hint}</span> : null}
    </div>
  );
}

/* -------------------------------- Field ------------------------------- */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink/90">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger animate-fade-in">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full rounded-2xl border bg-canvas-2/80 px-4 text-[15px] text-ink placeholder:text-faint/70 transition-colors focus:border-mint focus:bg-canvas-2 focus:outline-none";

export function TextInput({
  className,
  invalid,
  ref,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...rest} className={cn(inputBase, "h-12", invalid ? "border-danger/60" : "border-line", className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...rest}
        className={cn(inputBase, "h-12 appearance-none border-line pe-10 font-medium", className)}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 flex items-center text-muted" style={{ insetInlineEnd: "0.9rem" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m5 9 7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

export function TextArea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={cn(inputBase, "min-h-28 resize-y border-line py-3 leading-relaxed", className)}
    />
  );
}

/* -------------------------------- Switch ------------------------------ */

export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  id?: string;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <label htmlFor={inputId} className="block text-[15px] font-semibold text-ink">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs leading-relaxed text-faint">{description}</p> : null}
      </div>
      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "tap relative h-7 w-12 shrink-0 rounded-full border transition-colors",
          checked ? "border-mint/60 bg-mint/25" : "border-line bg-surface-3",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all duration-200",
            checked ? "bg-mint" : "bg-muted",
          )}
          style={{ insetInlineStart: checked ? "1.55rem" : "0.18rem" }}
        />
      </button>
    </div>
  );
}

/* --------------------------------- Chip ------------------------------- */

export function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "tap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap",
        active ? "border-mint/60 bg-mint/15 text-mint-soft" : "border-line bg-surface-2 text-muted hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------- Modal ------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/70 animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative z-10 w-full max-w-lg rounded-t-3xl border border-line bg-surface p-5 shadow-2xl animate-slide-in sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="tap rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink">
            <IconX size={20} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto no-scrollbar">{children}</div>
        {footer ? <div className="mt-5 flex gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

/* -------------------------------- Toast ------------------------------- */

export function Toast({ message, tone = "ok", onDone }: { message: string | null; tone?: "ok" | "error"; onDone?: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!message) {
      setShow(false);
      return;
    }
    setShow(true);
    const t = window.setTimeout(() => {
      setShow(false);
      onDone?.();
    }, 2600);
    return () => window.clearTimeout(t);
  }, [message, onDone]);

  if (!message || !show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4",
        "animate-fade-up",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-xl glass",
          tone === "ok" ? "border-mint/40 text-mint-soft" : "border-danger/40 text-danger",
        )}
      >
        {tone === "ok" ? <IconCheck size={16} /> : <IconX size={16} />}
        {message}
      </div>
    </div>
  );
}

/* ---------------------------- Category art ---------------------------- */

export const CATEGORY_ART: Record<CategoryId, { icon: (p: IconProps) => ReactNode; tint: string }> = {
  food: { icon: IconSparkle, tint: "text-gold bg-gold/12 border-gold/25" },
  transport: { icon: IconWave, tint: "text-mint bg-mint/12 border-mint/25" },
  bills: { icon: IconReceipt, tint: "text-[#ffb37a] bg-[#ffb37a]/12 border-[#ffb37a]/25" },
  health: { icon: IconShield, tint: "text-[#ff9bb3] bg-[#ff9bb3]/12 border-[#ff9bb3]/25" },
  communication: { icon: IconWave, tint: "text-[#8fd6ff] bg-[#8fd6ff]/12 border-[#8fd6ff]/25" },
  shopping: { icon: IconWallet, tint: "text-[#d7b3ff] bg-[#d7b3ff]/12 border-[#d7b3ff]/25" },
  education: { icon: IconReceipt, tint: "text-[#9fe8ff] bg-[#9fe8ff]/12 border-[#9fe8ff]/25" },
  home: { icon: IconWallet, tint: "text-[#ffd479] bg-[#ffd479]/12 border-[#ffd479]/25" },
  family: { icon: IconSparkle, tint: "text-[#ffb3d1] bg-[#ffb3d1]/12 border-[#ffb3d1]/25" },
  fun: { icon: IconSparkle, tint: "text-[#b8ff9f] bg-[#b8ff9f]/12 border-[#b8ff9f]/25" },
  personal: { icon: IconMic, tint: "text-[#c3f5e2] bg-[#c3f5e2]/12 border-[#c3f5e2]/25" },
  income: { icon: IconIncome, tint: "text-income bg-income/12 border-income/25" },
  other: { icon: IconReceipt, tint: "text-muted bg-surface-2 border-line" },
};

export function CategoryBadge({ category, size = 40 }: { category: CategoryId | string; size?: number }) {
  const art = CATEGORY_ART[(category as CategoryId) in CATEGORY_ART ? (category as CategoryId) : "other"];
  const Icon = art.icon;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-2xl border", art.tint)}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.5)} />
    </span>
  );
}

export function KindIcon({ kind }: { kind: string }) {
  return kind === "income" ? <IconIncome size={16} /> : <IconExpense size={16} />;
}

/* ------------------------------ Skeleton ----------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-surface-2", className)} />;
}

export function EmptyState({ icon, title, subtitle, action }: { icon: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-line px-6 py-14 text-center animate-fade-up">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface-2 text-mint">{icon}</span>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {subtitle ? <p className="max-w-sm text-sm leading-relaxed text-faint">{subtitle}</p> : null}
      {action}
    </div>
  );
}
