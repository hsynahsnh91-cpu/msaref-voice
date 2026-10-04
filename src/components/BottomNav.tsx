"use client";

import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import { IconInbox, IconMic, IconReceipt, IconSliders } from "./icons";

const TABS = [
  { href: "/inbox", key: "navInbox" as const, Icon: IconInbox, badge: true },
  { href: "/assistant", key: "navAssistant" as const, Icon: IconMic, badge: false },
  { href: "/transactions", key: "navTransactions" as const, Icon: IconReceipt, badge: false },
  { href: "/settings", key: "navSettings" as const, Icon: IconSliders, badge: false },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t, isAr } = useI18n();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await apiFetch("/api/recordings?count=pending", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { count?: number };
        if (alive) setPending(data.count ?? 0);
      } catch {
        /* offline is fine — the badge just stays put */
      }
    };
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("sarfi:inbox-changed", onVisible as EventListener);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("sarfi:inbox-changed", onVisible as EventListener);
    };
  }, [pathname]);

  return (
    <nav
      aria-label={isAr ? "التنقل السفلي" : "Bottom navigation"}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line-soft glass"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto grid max-w-3xl grid-cols-4">
        {TABS.map(({ href, key, Icon, badge }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const count = badge ? pending : 0;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "tap tap-soft group relative flex h-[4.5rem] flex-col items-center justify-center gap-1 rounded-none px-1",
                active ? "text-mint" : "text-faint hover:text-muted",
              )}
            >
              <span
                className={cn(
                  "absolute top-0 h-[3px] rounded-full bg-mint transition-all duration-300",
                  active ? "w-10 opacity-100" : "w-0 opacity-0",
                )}
              />
              <span className="relative">
                <Icon size={23} strokeWidth={active ? 2.1 : 1.7} />
                {count > 0 ? (
                  <span
                    className={cn(
                      "num absolute -top-1.5 -end-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold shadow animate-pop",
                      "border border-gold/40 bg-gold text-[#2a1c02]",
                    )}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </span>
              <span className={cn("text-[11px] font-semibold tracking-tight transition-colors", active && "font-bold")}>
                {t(key)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
