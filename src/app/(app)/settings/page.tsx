"use client";

import { useSession } from "@/components/SessionProvider";
import { SettingsClient } from "@/components/SettingsClient";
import { PageHeader } from "@/components/PageHeader";

export default function SettingsPage() {
  const { data } = useSession();
  if (!data?.budget) return null;

  return (
    <div>
      <PageHeader titleKey="settingsTitle" />
      <SettingsClient
        user={{ email: data.user.email, name: data.user.name, createdAt: data.user.createdAt }}
        prefs={data.prefs}
        budget={data.budget}
      />
    </div>
  );
}
