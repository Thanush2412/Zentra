import { NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME, type SessionPayload } from "@/lib/session";

/**
 * Session + role helpers for API routes.
 *
 * The session is derived ONLY from the HttpOnly cookie — never from query
 * params or request body (fixes API_OPTIMIZATION_PLAN issue #1: spoofed
 * role/userId scoping via query params).
 */

export function getSessionFromRequest(request: Request): SessionPayload | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").map(c => c.trim());
  for (const c of cookies) {
    const eq = c.indexOf("=");
    if (eq === -1) continue;
    if (c.slice(0, eq) === SESSION_COOKIE_NAME) {
      return verifySessionToken(c.slice(eq + 1));
    }
  }
  return null;
}

export class ApiAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** Throws ApiAuthError(401) when there is no valid session cookie. */
export function requireSession(request: Request): SessionPayload {
  const session = getSessionFromRequest(request);
  if (!session) {
    throw new ApiAuthError("Unauthorized: missing or invalid session.", 401);
  }
  return session;
}

const ROLE_ALIASES: Record<string, string> = {
  campus_manager: "cam",
  superadmin: "admin"
};

export function normalizeRole(role: string): string {
  return ROLE_ALIASES[role] || role;
}

/**
 * Verifies a valid session AND that the session's role is one of `allowed`.
 * Throws ApiAuthError with 401 (no session) or 403 (wrong role).
 */
export function requireRole(request: Request, ...allowed: string[]): SessionPayload {
  const session = requireSession(request);
  const sessionRole = normalizeRole(session.role);
  const normalized = allowed.map(normalizeRole);
  if (!normalized.includes(sessionRole)) {
    throw new ApiAuthError(`Forbidden: role '${sessionRole}' is not permitted for this action.`, 403);
  }
  return session;
}

/** Converts an ApiAuthError into a JSON 401/403 response. */
export function apiAuthErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof ApiAuthError) {
    return NextResponse.json({ success: false, message: err.message }, { status: err.status });
  }
  return null;
}
