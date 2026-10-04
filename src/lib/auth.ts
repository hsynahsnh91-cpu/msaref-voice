import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, userPrefs, users, type User } from "@/db/schema";

export const SESSION_COOKIE = "sawt_session";
const SESSION_TTL_DAYS = 30;
const HANDOFF_TTL_MS = 2 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Passwords                                                           */
/* ------------------------------------------------------------------ */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password.normalize("NFKC"), salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, digest] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !digest) return false;
  const derived = scryptSync(password.normalize("NFKC"), salt, 64);
  const expected = Buffer.from(digest, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export interface PasswordRules {
  ok: boolean;
  messageKey?: "passwordTooShort" | "passwordTooLong";
}

export function validatePassword(pw: string): PasswordRules {
  if (pw.length < 8) return { ok: false, messageKey: "passwordTooShort" };
  if (pw.length > 200) return { ok: false, messageKey: "passwordTooLong" };
  return { ok: true };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export async function createUser(email: string, password: string, name: string | null, locale: string) {
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: normalizeEmail(email),
    passwordHash: hashPassword(password),
    name: name?.trim() || null,
    locale,
  });
  await db.insert(userPrefs).values({ userId: id, locale });
  const row = await db.query.users.findFirst({ where: eq(users.id, id) });
  return row as User;
}

export async function findByEmail(email: string) {
  return db.query.users.findFirst({ where: eq(users.email, normalizeEmail(email)) });
}

/* ------------------------------------------------------------------ */
/* Sessions — cookie AND bearer token                                  */
/*                                                                     */
/* The preview runs inside a cross-site <iframe>. Browsers drop         */
/* SameSite=Lax cookies there, which caused the "sign in → back to the  */
/* sign-in page" loop. We now:                                          */
/*   1. set the cookie as SameSite=None; Secure; Partitioned on HTTPS   */
/*      (works in iframes, incl. Chrome's third-party-cookie blocking), */
/*   2. ALSO return the token so the client can send                   */
/*      `Authorization: Bearer <token>` (works even where every cookie  */
/*      is blocked, e.g. Safari ITP).                                   */
/* ------------------------------------------------------------------ */

async function isHttpsRequest(): Promise<boolean> {
  const h = await headers();
  const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim().toLowerCase();
  if (proto) return proto === "https";
  if (/proto=https/i.test(h.get("forwarded") ?? "")) return true;
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase();
  if (!host || host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]") || host.startsWith("0.0.0.0")) {
    return false;
  }
  // Public hostnames are served over TLS by the platform proxy.
  return true;
}

async function sessionCookieOptions(expires: Date) {
  const https = await isHttpsRequest();
  if (https) {
    return { httpOnly: true, secure: true, sameSite: "none" as const, partitioned: true, path: "/", expires };
  }
  return { httpOnly: true, secure: false, sameSite: "lax" as const, path: "/", expires };
}

/** Every token the current request carries (cookie first, then headers). */
async function candidateTokens(): Promise<string[]> {
  const out: string[] = [];
  const store = await cookies();
  const fromCookie = store.get(SESSION_COOKIE)?.value;
  if (fromCookie) out.push(fromCookie);
  const h = await headers();
  const auth = h.get("authorization") ?? "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer && !out.includes(bearer)) out.push(bearer);
  const custom = h.get("x-sarfi-session")?.trim();
  if (custom && !out.includes(custom)) out.push(custom);
  return out.filter((t) => t.length >= 20 && t.length <= 200);
}

export async function startSession(userId: string, userAgent?: string | null): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    userAgent: userAgent?.slice(0, 300) ?? null,
    expiresAt,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, await sessionCookieOptions(expiresAt));
  return token;
}

export async function endSession() {
  const tokens = await candidateTokens();
  for (const token of tokens) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  const store = await cookies();
  // A partitioned cookie can only be cleared with the same attributes.
  store.set(SESSION_COOKIE, "", { ...(await sessionCookieOptions(new Date(0))), maxAge: 0 });
}

export async function getCurrentUser(): Promise<User | null> {
  const tokens = await candidateTokens();
  for (const token of tokens) {
    const row = await db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (row.length) return row[0].user;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* One-time hand-off codes ("open in its own window")                   */
/* Stored with a different hash namespace so a code can never be used  */
/* directly as a session token.                                         */
/* ------------------------------------------------------------------ */

export async function createHandoffCode(userId: string): Promise<string> {
  const code = randomBytes(24).toString("base64url");
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(`handoff:${code}`),
    userAgent: "handoff",
    expiresAt: new Date(Date.now() + HANDOFF_TTL_MS),
  });
  return code;
}

export async function consumeHandoffCode(code: string): Promise<string | null> {
  if (!code || code.length < 20 || code.length > 200) return null;
  const rows = await db
    .delete(sessions)
    .where(and(eq(sessions.tokenHash, hashToken(`handoff:${code}`)), gt(sessions.expiresAt, new Date())))
    .returning({ userId: sessions.userId });
  return rows[0]?.userId ?? null;
}

/* ------------------------------------------------------------------ */
/* Preferences                                                          */
/* ------------------------------------------------------------------ */

export async function getPrefsWithDefaults(userId: string) {
  const row = await db.query.userPrefs.findFirst({ where: eq(userPrefs.userId, userId) });
  if (row) return row;
  await db.insert(userPrefs).values({ userId }).onConflictDoNothing();
  const created = await db.query.userPrefs.findFirst({ where: eq(userPrefs.userId, userId) });
  return created!;
}
