import { NextResponse } from "next/server";
import { findByEmail, startSession, verifyPassword } from "@/lib/auth";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: { code: "invalidCredentials" } }, { status: 400 });
  }

  const user = await findByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ ok: false, error: { code: "invalidCredentials" } }, { status: 401 });
  }

  const token = await startSession(user.id, req.headers.get("user-agent"));
  const budget = await db.query.budgets.findFirst({ where: eq(budgets.userId, user.id) });

  return NextResponse.json(
    { ok: true, needsBudget: !budget, token },
    { headers: { "Cache-Control": "no-store" } },
  );
}
