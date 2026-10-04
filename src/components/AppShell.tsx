"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "./SessionProvider";
import { useI18n } from "@/lib/i18n/provider";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { BrandMark } from "./Brand";

export function Splash({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 animate-fade-in" role="status" aria-live="polite">
      <span className="relative">
        <span className="absolute inset-0 rounded-[26%] bg-mint/25 animate-pulse-ring" />
        <BrandMark size={72} />
      </span>
      <p className="text-sm font-semibold text-muted">{label ?? t("loading")}</p>
    </div>
  );
}

/** Redirects signed-in visitors away from the sign-in / sign-up screens. */
export function GuestGuard() {
  const { status, data } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === "authenticated") router.replace(data?.budget ? "/assistant" : "/onboarding");
  }, [status, data?.budget, router]);
  return null;
}

/** Client-side guard for the tabbed app (works with cookie OR bearer token). */
export function AppShell({ children }: { children: ReactNode }) {
  const { status, data } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/sign-in");
    else if (status === "authenticated" && !data?.budget) router.replace("/onboarding");
  }, [status, data?.budget, router]);

  if (status !== "authenticated" || !data?.budget) return <Splash />;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-6">
      <AppHeader
        name={data.user.name}
        email={data.user.email}
        budgetAmount={data.budget.amount}
        budgetCurrency={data.budget.currency}
      />
      {/* Keyed by route: each tab fades/blurs in — no push or slide between tabs. */}
      <div key={pathname} className="mb-tabbar animate-tab-in">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
