import crypto from "crypto";

/**
 * Stateless HMAC-signed session tokens (no new deps — Node crypto only).
 *
 * Token format: base64url(payload).base64url(hmac-sha256(payload, secret))
 * Payload is a JSON object: { userId, role, email, collegeId, name, exp }
 *
 * The signing secret comes from SESSION_SECRET (required in production; a
 * dev-only fallback keeps local dev working without setup).
 */

export interface SessionPayload {
  userId: string;
  role: string;
  email?: string;
  collegeId?: string | null;
  name?: string | null;
  exp: number; // unix seconds
}

const DEFAULT_FALLBACK_SECRET = "ecampus-session-fallback-secret-key-32b-secure";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    return DEFAULT_FALLBACK_SECRET;
  }
  return secret;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

function sign(data: string): string {
  return b64url(crypto.createHmac("sha256", getSecret()).update(data).digest());
}

/** Constant-time comparison that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export const SESSION_COOKIE_NAME = "ecampus_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function createSessionToken(payload: Omit<SessionPayload, "exp">, ttlSeconds = SESSION_TTL_SECONDS): string {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  };
  const body = b64url(Buffer.from(JSON.stringify(full)));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;
  if (!safeEqual(sig, sign(body))) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as SessionPayload;
    if (!payload || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.userId || !payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Serialize the Set-Cookie header value for login responses. */
export function buildSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

/** Serialize the Set-Cookie header value that clears the session. */
export function buildClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
