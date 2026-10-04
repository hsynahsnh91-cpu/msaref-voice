"use client";

import { useSession } from "@/components/SessionProvider";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { PageHeader } from "@/components/PageHeader";

export default function AssistantPage() {
  const { data } = useSession();
  if (!data?.budget) return null;

  return (
    <div>
      <PageHeader titleKey="assistantTitle" subtitleKey="assistantSubtitle" />
      <VoiceRecorder
        prefs={{
          muteReplay: data.prefs.muteReplay,
          speakConfirmations: data.prefs.speakConfirmations,
          voiceUri: data.prefs.voiceUri,
          speechRate: data.prefs.speechRate,
          speechPitch: data.prefs.speechPitch,
        }}
        budgetCurrency={data.budget.currency}
      />
    </div>
  );
}
