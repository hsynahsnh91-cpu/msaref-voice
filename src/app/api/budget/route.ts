import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CURRENCIES, type CurrencyCode } from "@/lib/money";
import { clamp } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });
  const budget = await db.query.budgets.findFirst({ where: eq(budgets.userId, user.id) });
  return NextResponse.json({
    ok: true,
    budget: budget
      ? {
          amount: Number(budget.amount),
          currency: budget.currency,
          cycleStartDay: budget.cycleStartDay,
        }
      : null,
  });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const rawAmount = typeof body.amount === "string" ? Number.parseFloat(body.amount) : Number(body.amount);
  const currency = typeof body.currency === "string" ? body.currency : "SYP_NEW";
  const cycleStartDay = clamp(Number(body.cycleStartDay ?? 1) || 1, 1, 28);

  if (!Number.isFinite(rawAmount) || rawAmount <= 0 || rawAmount > 1_000_000_000) {
    return NextResponse.json({ ok: false, error: { code: "budgetError" } }, { status: 400 });
  }
  const known: CurrencyCode[] = CURRENCIES.map((c) => c.code);
  const finalCurrency = known.includes(currency as CurrencyCode) ? (currency as CurrencyCode) : "SYP_NEW";
  const amount = Math.round(rawAmount * 100) / 100;

  const existing = await db.query.budgets.findFirst({ where: eq(budgets.userId, user.id) });
  if (existing) {
    await db
      .update(budgets)
      .set({ amount: String(amount), currency: finalCurrency, cycleStartDay, updatedAt: new Date() })
      .where(eq(budgets.userId, user.id));
  } else {
    await db.insert(budgets).values({
      userId: user.id,
      amount: String(amount),
      currency: finalCurrency,
      cycleStartDay,
    });
  }

  return NextResponse.json({ ok: true, budget: { amount, currency: finalCurrency, cycleStartDay } });
}
