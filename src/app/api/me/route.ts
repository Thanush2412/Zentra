import { NextResponse } from "next/server";
import { requireSession, apiAuthErrorResponse, normalizeRole } from "@/lib/api-auth";
import { getDb } from "@/lib/db";

/**
 * GET /api/me — returns the caller's identity from the HttpOnly session cookie.
 *
 * The frontend should use this INSTEAD of localStorage `fp_*_id` keys to know
 * who is logged in (ROLE_UI_AUDIT items C1 / S3 / E1). The profile object is
 * fetched fresh from the DB, so a stale localStorage snapshot can never render
 * another user's dashboard.
 */

const PROFILE_TABLES: Record<string, string> = {
  admin: "admin_users",
  kam: "kam_users",
  cam: "campus_managers",
  mentor: "mentors",
  student: "students",
  sme: "sme_users",
  fee_manager: "users",
  hr: "users",
  allocator: "users"
};

export async function GET(request: Request) {
  try {
    const session = requireSession(request);
    const role = normalizeRole(session.role);
    const userId = session.userId;

    let profile: Record<string, unknown> | null = null;
    const table = PROFILE_TABLES[role];

    if (table && userId) {
      try {
        const db = await getDb();
        // Session userId is the role-profile id (reference_id) at login; fall back
        // to email match for legacy accounts whose reference_id differs.
        profile = await db.get(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`, userId) || null;
        if (!profile && session.email) {
          profile = await db.get(`SELECT * FROM ${table} WHERE email = ? LIMIT 1`, session.email) || null;
        }
        if (!profile && (role === "fee_manager" || role === "hr" || role === "allocator")) {
          profile = await db.get("SELECT * FROM users WHERE id = ? OR email = ? LIMIT 1", userId, session.email || "") || null;
        }
      } catch (err) {
        console.error("[/api/me] profile lookup failed:", err);
      }
    }

    return NextResponse.json({
      success: true,
      session: {
        userId,
        role,
        email: session.email || null,
        collegeId: session.collegeId || null,
        name: session.name || null,
        exp: session.exp
      },
      profile
    });
  } catch (err) {
    const authRes = apiAuthErrorResponse(err);
    if (authRes) return authRes;
    return NextResponse.json({ success: false, message: "Failed to resolve session." }, { status: 500 });
  }
}
