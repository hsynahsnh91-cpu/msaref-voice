"use client";

import { useSession } from "@/components/SessionProvider";
import { InboxClient } from "@/components/InboxClient";
import { PageHeader } from "@/components/PageHeader";

export default function InboxPage() {
  const { data } = useSession();
  if (!data?.budget) return null;

  return (
    <div>
      <PageHeader titleKey="inboxTitle" subtitleKey="inboxSubtitle" />
      <InboxClient initial={[]} currency={data.budget.currency} />
    </div>
  );
}
