"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Popover({
  trigger,
  children,
  align = "start",
  className,
  label,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger: (props: { open: boolean; toggle: () => void; ref: React.Ref<HTMLButtonElement>; id: string }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end" | "center";
  className?: string;
  label: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internal, setInternal] = useState(false);
  const open = controlledOpen ?? internal;
  const setOpen = (v: boolean) => {
    if (controlledOpen === undefined) setInternal(v);
    onOpenChange?.(v);
  };
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={rootRef} className="relative">
      {trigger({ open, toggle: () => setOpen(!open), ref: btnRef, id })}
      {open ? (
        <div
          id={`${id}-panel`}
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute z-50 mt-2 w-max max-w-[calc(100vw-2rem)] rounded-3xl border border-line bg-surface p-3 shadow-2xl animate-pop",
            align === "start" && "start-0",
            align === "end" && "end-0",
            align === "center" && "start-1/2 -translate-x-1/2 rtl:translate-x-1/2",
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}
