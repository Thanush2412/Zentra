import { NextResponse } from "next/server";
import { type SessionPayload, validateSession } from "@/lib/session";
import { getDb } from "@/lib/db";
import { extractSessionToken, resolveLiveUser, normalizeRole } from "@/lib/authGuard";

/**
 * Session + role helpers for API routes.
 *
 * Derived securely from the HttpOnly session cookie and verified against the database.
 */

export class ApiAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

const ROLE_ALIASES: Record<string, string> = {
  cam: "cm",              // legacy token (pre-rename DB rows)
  campus_manager: "cm",  // long-form alias
  superadmin: "admin"
};

export function normalizeRole(role: string): string {
  return ROLE_ALIASES[role] || role;
}

export async function getSessionFromRequest(request: Request): Promise<SessionPayload | null> {
  const token = extractSessionToken(request);
  if (!token) return null;
  try {
    const db = await getDb();
    const validated = await validateSession(db, token);
    if (!validated.isValid || !validated.userId) return null;
    const liveUser = await resolveLiveUser(db, validated.userId);
    if (!liveUser) return null;
    return {
      userId: liveUser.reference_id || liveUser.id,
      role: liveUser.role,
      email: liveUser.email,
      collegeId: liveUser.college_id,
      name: liveUser.name
    };
  } catch {
    return null;
  }
}

/** Throws ApiAuthError(401) when there is no valid session cookie. */
export async function requireSession(request: Request): Promise<SessionPayload> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    throw new ApiAuthError("Unauthorized: missing or invalid session.", 401);
  }
  return session;
}

/**
 * Verifies a valid session AND that the session's role is one of `allowed`.
 * Throws ApiAuthError with 401 (no session) or 403 (wrong role).
 */
export async function requireRole(request: Request, ...allowed: string[]): Promise<SessionPayload> {
  const session = await requireSession(request);
  const sessionRole = normalizeRole(session.role);
  const normalized = allowed.map(normalizeRole);
  if (!normalized.includes(sessionRole) && sessionRole !== "admin") {
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
