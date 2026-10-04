import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { recordings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: { code: "unauthorized" } }, { status: 401 });
  const { id } = await ctx.params;

  const row = await db.query.recordings.findFirst({
    where: and(eq(recordings.id, id), eq(recordings.userId, user.id)),
  });
  if (!row || !row.audioBase64) {
    return NextResponse.json({ ok: false, error: { code: "noAudio" } }, { status: 404 });
  }

  const bytes = Buffer.from(row.audioBase64, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": row.mimeType || "audio/webm",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "none",
    },
  });
}
