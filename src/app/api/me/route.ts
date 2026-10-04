import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { getCurrentUser, getPrefsWithDefaults } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Single source of truth for the client session: user + budget + preferences. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized" } }, { status: 401, headers: NO_STORE });
  }

  const [budget, prefs] = await Promise.all([
    db.query.budgets.findFirst({ where: eq(budgets.userId, user.id) }),
    getPrefsWithDefaults(user.id),
  ]);

  return NextResponse.json(
    {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      },
      budget: budget
        ? { amount: Number(budget.amount), currency: budget.currency, cycleStartDay: budget.cycleStartDay }
        : null,
      prefs: {
        locale: prefs.locale === "en" ? "en" : "ar",
        muteReplay: prefs.muteReplay,
        speakConfirmations: prefs.speakConfirmations,
        voiceUri: prefs.voiceUri,
        speechRate: prefs.speechRate,
        speechPitch: prefs.speechPitch,
      },
    },
    { headers: NO_STORE },
  );
}
