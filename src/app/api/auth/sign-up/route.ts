import { NextResponse } from "next/server";
import { createUser, findByEmail, isValidEmail, startSession, validatePassword } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function readBody(req: Request) {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

export async function POST(req: Request) {
  const body = await readBody(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name : null;
  const locale = body.locale === "en" ? "en" : "ar";

  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: { code: "invalidEmail" } }, { status: 400 });
  }
  const rules = validatePassword(password);
  if (!rules.ok) {
    return NextResponse.json({ ok: false, error: { code: rules.messageKey } }, { status: 400 });
  }

  const existing = await findByEmail(email);
  if (existing) {
    return NextResponse.json({ ok: false, error: { code: "emailTaken" } }, { status: 409 });
  }

  const user = await createUser(email, password, name, locale);
  await db.update(users).set({ locale }).where(eq(users.id, user.id));
  const token = await startSession(user.id, req.headers.get("user-agent"));

  return NextResponse.json({ ok: true, needsBudget: true, token }, { headers: { "Cache-Control": "no-store" } });
}
