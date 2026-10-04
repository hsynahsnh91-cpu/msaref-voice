import { NextResponse } from "next/server";
import { and, asc, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { budgets, transactions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { CURRENCIES, convertAmount, type CurrencyCode } from "@/lib/money";
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import { isValidCivilDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = CATEGORIES.map((c) => c.id) as CategoryId[];
const VALID_CURRENCIES = CURRENCIES.map((c) => c.code) as CurrencyCode[];

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const category = url.searchParams.get("category");
  const kind = url.searchParams.get("kind");
  const q = url.searchParams.get("q")?.trim();

  const filters = [eq(transactions.userId, user.id)];
  if (isValidCivilDate(from)) filters.push(gte(transactions.occurredOn, from));
  if (isValidCivilDate(to)) filters.push(lte(transactions.occurredOn, to));
  if (category && VALID_CATEGORIES.includes(category as CategoryId)) {
    filters.push(eq(transactions.category, category));
  }
  if (kind === "expense" || kind === "income") filters.push(eq(transactions.kind, kind));
  if (q) {
    const like = or(ilike(transactions.note, `%${q}%`), ilike(transactions.category, `%${q}%`));
    if (like) filters.push(like);
  }

  const rows = await db
    .select()
    .from(transactions)
    .where(and(...filters))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt), asc(transactions.id))
    .limit(1000);

  const budget = await db.query.budgets.findFirst({ where: eq(budgets.userId, user.id) });
  const budgetCurrency = budget?.currency ?? "SYP_NEW";

  let spent = 0;
  let income = 0;
  let unconverted = 0;
  const perCategory = new Map<string, number>();

  for (const row of rows) {
    const amount = Number(row.amount);
    const converted = convertAmount(amount, row.currency, budgetCurrency);
    const value = converted ?? amount;
    if (converted === null && row.currency !== budgetCurrency) unconverted += amount;
    if (row.kind === "income") income += value;
    else {
      spent += value;
      perCategory.set(row.category, (perCategory.get(row.category) ?? 0) + value);
    }
  }

  return NextResponse.json({
    ok: true,
    budgetCurrency,
    budgetAmount: budget ? Number(budget.amount) : null,
    summary: {
      spent: Math.round(spent * 100) / 100,
      income: Math.round(income * 100) / 100,
      unconverted: Math.round(unconverted * 100) / 100,
      count: rows.length,
      perCategory: Object.fromEntries(perCategory),
    },
    transactions: rows.map((r) => ({
      id: r.id,
      occurredOn: r.occurredOn,
      amount: Number(r.amount),
      currency: r.currency,
      kind: r.kind,
      category: r.category,
      note: r.note,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const rawAmount = typeof body.amount === "string" ? Number.parseFloat(body.amount) : Number(body.amount);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0 || rawAmount > 1_000_000_000) {
    return NextResponse.json({ ok: false, error: { code: "budgetError" } }, { status: 400 });
  }
  const currencyRaw = typeof body.currency === "string" ? body.currency : "SYP_NEW";
  const currency = VALID_CURRENCIES.includes(currencyRaw as CurrencyCode) ? (currencyRaw as CurrencyCode) : "SYP_NEW";
  const categoryRaw = typeof body.category === "string" ? body.category : "other";
  const category = VALID_CATEGORIES.includes(categoryRaw as CategoryId) ? categoryRaw : "other";
  const kind = body.kind === "income" ? "income" : "expense";
  const occurredOn = isValidCivilDate(body.occurredOn as string)
    ? (body.occurredOn as string)
    : new Intl.DateTimeFormat("en-CA").format(new Date());
  const note = typeof body.note === "string" ? body.note.slice(0, 400) : null;
  const source = body.source === "voice" ? "voice" : "manual";

  const [row] = await db
    .insert(transactions)
    .values({
      userId: user.id,
      occurredOn,
      amount: String(Math.round(rawAmount * 100) / 100),
      currency,
      category,
      kind,
      note,
      source,
    })
    .returning();

  return NextResponse.json({
    ok: true,
    transaction: {
      id: row.id,
      occurredOn: row.occurredOn,
      amount: Number(row.amount),
      currency: row.currency,
      kind: row.kind,
      category: row.category,
      note: row.note,
      source: row.source,
    },
  });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: { code: "notFound" } }, { status: 400 });
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
  return NextResponse.json({ ok: true });
}


