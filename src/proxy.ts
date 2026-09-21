import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Session verification for all /api/* routes (API_OPTIMIZATION_PLAN item 6).
 *
 * Next.js 16 uses `proxy.ts` (formerly `middleware.ts`) and runs on the edge
 * runtime, so the HMAC check uses Web Crypto — the token format is identical
 * to lib/session.ts (Node crypto side).
 *
 * Public endpoints (no session required):
 *  - POST /api/login           (issues the session cookie)
 *  - POST /api/signup          (public signup-request form)
 *  - POST /api/change-password (authenticated in-route against current password)
 *  - GET  /api/health          (uptime monitoring — intentionally unauthenticated)
 */

const SESSION_COOKIE_NAME = "ecampus_session";

const DEFAULT_FALLBACK_SECRET = "ecampus-session-fallback-secret-key-32b-secure";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    return DEFAULT_FALLBACK_SECRET;
  }
  return secret;
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signAsync(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyToken(token: string | undefined | null): Promise<{ userId: string; role: string } | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;
  const expected = await signAsync(body);
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (typeof payload?.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.userId || !payload.role) return null;
    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

/** Endpoints reachable without a session cookie. */
const PUBLIC_PATHS = new Set<string>(["/api/login", "/api/signup", "/api/change-password", "/api/health"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifyToken(token);

  if (!session) {
    console.warn(JSON.stringify({ ts: new Date().toISOString(), level: "warn", msg: "api_auth_rejected", path: pathname }));
    return NextResponse.json(
      { success: false, message: "Unauthorized: missing or invalid session." },
      { status: 401 }
    );
  }

  const requestHeaders = new Headers(request.headers);
  // Expose verified identity to route handlers without re-parsing the cookie.
  // (Set on the REQUEST, not the response — response headers go to the client.)
  requestHeaders.set("x-session-user-id", encodeURIComponent(session.userId));
  requestHeaders.set("x-session-role", encodeURIComponent(session.role));
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/api/:path*"]
};
