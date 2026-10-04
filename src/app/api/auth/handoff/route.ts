import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { consumeHandoffCode, createHandoffCode, getCurrentUser, startSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Moves a signed-in session from the embedded preview to a standalone window
 * (where the browser allows microphone access) using a single-use, 2-minute code.
 *   { action: "create" }            -> { code }        (requires a session)
 *   { action: "exchange", code }    -> { token, needsBudget }
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === "create") {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: { code: "unauthorized" } }, { status: 401, headers: NO_STORE });
    const code = await createHandoffCode(user.id);
    return NextResponse.json({ ok: true, code }, { headers: NO_STORE });
  }

  if (body.action === "exchange") {
    const code = typeof body.code === "string" ? body.code : "";
    const userId = await consumeHandoffCode(code);
    if (!userId) {
      return NextResponse.json({ ok: false, error: { code: "handoffFailed" } }, { status: 400, headers: NO_STORE });
    }
    const token = await startSession(userId, req.headers.get("user-agent"));
    const budget = await db.query.budgets.findFirst({ where: eq(budgets.userId, userId) });
    return NextResponse.json({ ok: true, token, needsBudget: !budget }, { headers: NO_STORE });
  }

  return NextResponse.json({ ok: false, error: { code: "badRequest" } }, { status: 400, headers: NO_STORE });
}
