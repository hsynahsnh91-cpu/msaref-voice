import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { recordings, transactions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { CURRENCIES, type CurrencyCode } from "@/lib/money";
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import { isValidCivilDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });
  const { id } = await ctx.params;
  await db.delete(recordings).where(and(eq(recordings.id, id), eq(recordings.userId, user.id)));
  return NextResponse.json({ ok: true });
}

/** Turns an inbox recording into a real transaction. */
export async function POST(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });
  const { id } = await ctx.params;

  const existing = await db.query.recordings.findFirst({
    where: and(eq(recordings.id, id), eq(recordings.userId, user.id)),
  });
  if (!existing) return NextResponse.json({ ok: false, error: { code: "notFound" } }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const amountRaw =
    typeof body.amount === "string" ? Number.parseFloat(body.amount) : Number(body.amount ?? existing.parsedAmount);
  const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? Math.round(amountRaw * 100) / 100 : null;
  if (amount === null) {
    return NextResponse.json({ ok: false, error: { code: "nothingDetected" } }, { status: 400 });
  }

  const currencyCodes = CURRENCIES.map((c) => c.code) as CurrencyCode[];
  const currencyRaw = typeof body.currency === "string" ? body.currency : (existing.parsedCurrency ?? "SYP_NEW");
  const currency = currencyCodes.includes(currencyRaw as CurrencyCode) ? currencyRaw : "SYP_NEW";
  const categoryIds = CATEGORIES.map((c) => c.id) as CategoryId[];
  const categoryRaw = typeof body.category === "string" ? body.category : (existing.parsedCategory ?? "other");
  const category = categoryIds.includes(categoryRaw as CategoryId) ? categoryRaw : "other";
  const kind = (body.kind === "income" || body.kind === "expense" ? body.kind : existing.parsedKind) ?? "expense";
  const dateRaw = typeof body.date === "string" ? body.date : (existing.parsedDate ?? undefined);
  const occurredOn = isValidCivilDate(dateRaw) ? dateRaw : new Intl.DateTimeFormat("en-CA").format(new Date());
  const note =
    typeof body.note === "string"
      ? body.note.slice(0, 400)
      : (existing.parsedNote ?? existing.transcript.slice(0, 400));

  const [tx] = await db
    .insert(transactions)
    .values({
      userId: user.id,
      occurredOn,
      amount: String(amount),
      currency,
      category,
      kind,
      note,
      source: "voice",
    })
    .returning();

  await db
    .update(recordings)
    .set({ status: "saved", transactionId: tx.id, parsedAmount: String(amount), parsedCurrency: currency, parsedCategory: category, parsedDate: occurredOn, parsedKind: kind, parsedNote: note })
    .where(eq(recordings.id, id));

  return NextResponse.json({ ok: true, transactionId: tx.id });
}
