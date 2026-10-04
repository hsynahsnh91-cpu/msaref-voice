"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/components/SessionProvider";
import { Splash } from "@/components/AppShell";
import { BudgetOnboarding } from "@/components/BudgetOnboarding";

export default function OnboardingPage() {
  const { status, data } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/sign-in");
  }, [status, router]);

  if (status !== "authenticated" || !data) return <Splash />;

  return (
    <BudgetOnboarding
      initialAmount={data.budget?.amount ?? null}
      initialCurrency={data.budget?.currency ?? "SYP_NEW"}
      initialCycleDay={data.budget?.cycleStartDay ?? 1}
      firstName={data.user.name}
    />
  );
}
