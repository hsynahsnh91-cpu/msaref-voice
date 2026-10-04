"use client";

import { useSession } from "@/components/SessionProvider";
import { TransactionsClient } from "@/components/TransactionsClient";
import { PageHeader } from "@/components/PageHeader";

const EMPTY_SUMMARY = { spent: 0, income: 0, unconverted: 0, count: 0, perCategory: {} };

export default function TransactionsPage() {
  const { data } = useSession();
  if (!data?.budget) return null;

  return (
    <div>
      <PageHeader titleKey="transactionsTitle" subtitleKey="transactionsSubtitle" />
      <TransactionsClient
        key={`${data.budget.currency}-${data.budget.cycleStartDay}`}
        initial={[]}
        summary={EMPTY_SUMMARY}
        budgetAmount={data.budget.amount}
        budgetCurrency={data.budget.currency}
        cycleStartDay={data.budget.cycleStartDay}
      />
    </div>
  );
}
