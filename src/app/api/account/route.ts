import { NextResponse } from "next/server";
import { endSession, getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ ok: true, user: user ? { email: user.email, name: user.name } : null });
}

/** Deletes the account and every row that belongs to it (cascade). */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });
  await db.delete(users).where(eq(users.id, user.id));
  await endSession();
  return NextResponse.json({ ok: true });
}
