import { NextResponse } from "next/server";
import { getCurrentUser, getPrefsWithDefaults } from "@/lib/auth";
import { db } from "@/db";
import { userPrefs, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { clamp } from "@/lib/utils";

export const dynamic = "force-dynamic";

function serialize(p: {
  locale: string;
  muteReplay: boolean;
  speakConfirmations: boolean;
  voiceUri: string | null;
  speechRate: number;
  speechPitch: number;
}) {
  return {
    locale: p.locale === "en" ? "en" : "ar",
    muteReplay: p.muteReplay,
    speakConfirmations: p.speakConfirmations,
    voiceUri: p.voiceUri,
    speechRate: p.speechRate,
    speechPitch: p.speechPitch,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });
  const prefs = await getPrefsWithDefaults(user.id);
  return NextResponse.json({ ok: true, prefs: serialize(prefs) });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const current = await getPrefsWithDefaults(user.id);

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.locale === "ar" || body.locale === "en") {
    patch.locale = body.locale;
    await db.update(users).set({ locale: body.locale }).where(eq(users.id, user.id));
  }
  if (typeof body.muteReplay === "boolean") patch.muteReplay = body.muteReplay;
  if (typeof body.speakConfirmations === "boolean") patch.speakConfirmations = body.speakConfirmations;
  if (typeof body.voiceUri === "string" || body.voiceUri === null) patch.voiceUri = body.voiceUri;
  if (typeof body.speechRate === "number") patch.speechRate = clamp(body.speechRate, 0.5, 1.8);
  if (typeof body.speechPitch === "number") patch.speechPitch = clamp(body.speechPitch, 0.5, 1.6);

  await db.update(userPrefs).set(patch).where(eq(userPrefs.userId, user.id));
  const fresh = await getPrefsWithDefaults(user.id);
  return NextResponse.json({ ok: true, prefs: serialize(fresh) });
}
