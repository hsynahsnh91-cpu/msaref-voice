"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/components/SessionProvider";
import { Splash } from "@/components/AppShell";

export default function Home() {
  const { status, data } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/sign-in");
    else if (status === "authenticated") router.replace(data?.budget ? "/assistant" : "/onboarding");
  }, [status, data?.budget, router]);

  return <Splash />;
}
