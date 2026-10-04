import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { recordings, transactions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { CURRENCIES, type CurrencyCode } from "@/lib/money";
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import { isValidCivilDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MAX_AUDIO_CHARS = 6_000_000; // ~4.5MB of binary audio

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });

  const url = new URL(req.url);
  const onlyCount = url.searchParams.get("count") === "pending";

  if (onlyCount) {
    const rows = await db
      .select({ id: recordings.id })
      .from(recordings)
      .where(and(eq(recordings.userId, user.id), eq(recordings.status, "pending")));
    return NextResponse.json({ ok: true, count: rows.length });
  }

  const rows = await db
    .select({
      id: recordings.id,
      transcript: recordings.transcript,
      status: recordings.status,
      durationMs: recordings.durationMs,
      mimeType: recordings.mimeType,
      hasAudio: recordings.audioBase64,
      parsedAmount: recordings.parsedAmount,
      parsedCurrency: recordings.parsedCurrency,
      parsedCategory: recordings.parsedCategory,
      parsedNote: recordings.parsedNote,
      parsedDate: recordings.parsedDate,
      parsedKind: recordings.parsedKind,
      transactionId: recordings.transactionId,
      createdAt: recordings.createdAt,
    })
    .from(recordings)
    .where(eq(recordings.userId, user.id))
    .orderBy(desc(recordings.createdAt))
    .limit(200);

  return NextResponse.json({
    ok: true,
    recordings: rows.map((r) => ({
      id: r.id,
      transcript: r.transcript,
      status: r.status,
      durationMs: r.durationMs,
      mimeType: r.mimeType,
      hasAudio: Boolean(r.hasAudio),
      parsedAmount: r.parsedAmount === null ? null : Number(r.parsedAmount),
      parsedCurrency: r.parsedCurrency,
      parsedCategory: r.parsedCategory,
      parsedNote: r.parsedNote,
      parsedDate: r.parsedDate,
      parsedKind: r.parsedKind,
      transactionId: r.transactionId,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const transcript = typeof body.transcript === "string" ? body.transcript.trim().slice(0, 1200) : "";
  const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64.replace(/^data:[^,]*,/, "") : null;
  if (audioBase64 && audioBase64.length > MAX_AUDIO_CHARS) {
    return NextResponse.json({ ok: false, error: { code: "audioTooLarge" } }, { status: 413 });
  }
  if (!transcript && !audioBase64) {
    return NextResponse.json({ ok: false, error: { code: "noTranscript" } }, { status: 400 });
  }

  const amountRaw = typeof body.amount === "string" ? Number.parseFloat(body.amount) : Number(body.amount);
  const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? Math.round(amountRaw * 100) / 100 : null;
  const currencyCodes = CURRENCIES.map((c) => c.code) as CurrencyCode[];
  const currency =
    typeof body.currency === "string" && currencyCodes.includes(body.currency as CurrencyCode)
      ? (body.currency as CurrencyCode)
      : null;
  const categoryIds = CATEGORIES.map((c) => c.id) as CategoryId[];
  const category = typeof body.category === "string" && categoryIds.includes(body.category as CategoryId) ? body.category : null;
  const kind = body.kind === "income" ? "income" : body.kind === "expense" ? "expense" : null;
  const parsedDate = isValidCivilDate(body.date as string) ? (body.date as string) : null;
  const parsedNote = typeof body.note === "string" ? body.note.slice(0, 400) : null;
  const saveNow = body.save === true;

  const [row] = await db
    .insert(recordings)
    .values({
      userId: user.id,
      transcript: transcript || "(بدون نص)",
      audioBase64,
      mimeType: typeof body.mimeType === "string" ? body.mimeType : null,
      durationMs: typeof body.durationMs === "number" ? Math.round(body.durationMs) : null,
      status: saveNow ? "saved" : "pending",
      parsedAmount: amount === null ? null : String(amount),
      parsedCurrency: currency,
      parsedCategory: category,
      parsedNote,
      parsedDate,
      parsedKind: kind,
    })
    .returning();

  let transactionId: string | null = null;
  if (saveNow && amount !== null) {
    const [tx] = await db
      .insert(transactions)
      .values({
        userId: user.id,
        occurredOn: parsedDate ?? new Intl.DateTimeFormat("en-CA").format(new Date()),
        amount: String(amount),
        currency: currency ?? "SYP_NEW",
        category: category ?? "other",
        kind: kind ?? "expense",
        note: parsedNote ?? transcript.slice(0, 400),
        source: "voice",
      })
      .returning();
    transactionId = tx.id;
    await db.update(recordings).set({ transactionId, status: "saved" }).where(eq(recordings.id, row.id));
  }

  return NextResponse.json({ ok: true, id: row.id, transactionId });
}
