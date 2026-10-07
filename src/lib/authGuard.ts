import { NextResponse } from "next/server";
import { getDb, PostgresDbAdapter } from "@/lib/db";
import { validateSession, SESSION_COOKIE_NAME, UserSessionRecord } from "@/lib/session";
import { verifyCsrfToken, CSRF_HEADER_NAME, generateCsrfToken } from "@/lib/csrf";
import { roleGrantsSuperAdmin } from "@/lib/superadmin";

export type Role = "admin" | "cam" | "mentor" | "student" | "kam" | "sme" | "fee_manager" | "L and D" | "hr";

export interface AuthenticatedUser {
  id: string;              // users.id
  reference_id: string;    // profile ID (e.g. mentor_1, cam_1, student_1)
  role: Role;
  email: string;
  name: string;
  college_id?: string | null;
  isSuperAdmin: boolean;
  mustChangePassword?: boolean;
}

export interface AuthGuardResult {
  user: AuthenticatedUser;
  session: UserSessionRecord;
  csrfToken: string;
}

export interface RequireAuthOptions {
  allowedRoles?: Role[];
  checkCsrf?: boolean;
}

/** Profile tables that hold display names and metadata for each role */
const ROLE_PROFILE_TABLES: Record<string, string> = {
  admin: "admin_users",
  cam: "campus_managers",
  mentor: "mentors",
  student: "students",
  kam: "kam_users",
  sme: "sme_users",
};

/**
 * Extracts session token from incoming request cookies
 */
export function extractSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") || "";
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map(c => c.trim());
  const prefix = `${SESSION_COOKIE_NAME}=`;
  const sessionCookie = cookies.find(c => c.startsWith(prefix));
  if (!sessionCookie) return null;

  return decodeURIComponent(sessionCookie.substring(prefix.length).trim());
}

/**
 * Resolves current live user record and role details from the database
 */
export async function resolveLiveUser(
  db: PostgresDbAdapter,
  userId: string
): Promise<AuthenticatedUser | null> {
  const user = await db.get(
    "SELECT * FROM users WHERE id = ? OR reference_id = ? OR LOWER(email) = ?",
    [userId, userId, userId.toLowerCase()]
  );

  if (!user) return null;

  const role = (user.role || "student").toLowerCase() as Role;
  let name = user.name || "";
  let collegeId: string | null = null;

  // Query role table for authoritative name and campus assignment
  try {
    const table = ROLE_PROFILE_TABLES[role];
    if (table) {
      const profile = await db.get(
        `SELECT * FROM ${table} WHERE id = ? OR LOWER(email) = ?`,
        [user.reference_id || user.id, String(user.email || "").toLowerCase()]
      );
      if (profile) {
        if (profile.name) name = profile.name;
        if (profile.college_id) collegeId = profile.college_id;
      }
    }
  } catch (_) {}

  return {
    id: user.id,
    reference_id: user.reference_id || user.id,
    role,
    email: user.email || "",
    name: name || user.email || "User",
    college_id: collegeId,
    isSuperAdmin: roleGrantsSuperAdmin(role),
    mustChangePassword: user.must_change_password === 1
  };
}

/**
 * Server-Side In-Route Guard
 * 
 * Verifies:
 * 1. Valid non-revoked session exists in DB for cookie token.
 * 2. Inactivity does not exceed 60 minutes.
 * 3. 7-day hard maximum ceiling is not exceeded.
 * 4. CSRF token validity on mutating HTTP methods (POST, PUT, DELETE, PATCH).
 * 5. Live role permissions on the server.
 */
export async function requireAuth(
  request: Request,
  options: RequireAuthOptions = {}
): Promise<{ auth?: AuthGuardResult; errorResponse?: NextResponse }> {
  try {
    const rawToken = extractSessionToken(request);
    if (!rawToken) {
      return {
        errorResponse: NextResponse.json(
          { success: false, message: "Unauthorized: No session token provided.", code: "NO_SESSION" },
          { status: 401 }
        )
      };
    }

    const db = await getDb();
    const sessionRes = await validateSession(db, rawToken);

    if (!sessionRes.isValid || !sessionRes.session || !sessionRes.userId) {
      const code = sessionRes.reason === "idle_timeout" ? "SESSION_IDLE" : "SESSION_EXPIRED";
      const msg = sessionRes.reason === "idle_timeout"
        ? "Session expired due to 60 minutes of inactivity. Please log in again."
        : "Unauthorized: Invalid or expired session.";

      return {
        errorResponse: NextResponse.json(
          { success: false, message: msg, code },
          { status: 401 }
        )
      };
    }

    // CSRF Check for state-mutating requests
    const method = request.method.toUpperCase();
    const isMutation = method === "POST" || method === "PUT" || method === "DELETE" || method === "PATCH";
    const checkCsrf = options.checkCsrf ?? isMutation;

    if (checkCsrf) {
      const submittedCsrf = request.headers.get(CSRF_HEADER_NAME);
      const isCsrfValid = verifyCsrfToken(submittedCsrf, sessionRes.csrfSecret);

      if (!isCsrfValid) {
        return {
          errorResponse: NextResponse.json(
            { success: false, message: "Forbidden: Invalid or missing CSRF token.", code: "INVALID_CSRF" },
            { status: 403 }
          )
        };
      }
    }

    // Authoritative Live User Resolution
    const user = await resolveLiveUser(db, sessionRes.userId);
    if (!user) {
      return {
        errorResponse: NextResponse.json(
          { success: false, message: "Unauthorized: User account not found or deactivated.", code: "USER_NOT_FOUND" },
          { status: 401 }
        )
      };
    }

    // Role Permission Check
    if (options.allowedRoles && options.allowedRoles.length > 0) {
      const isAllowed = user.isSuperAdmin || options.allowedRoles.includes(user.role);
      if (!isAllowed) {
        return {
          errorResponse: NextResponse.json(
            { success: false, message: `Forbidden: Role '${user.role}' is not authorized to perform this action.`, code: "FORBIDDEN_ROLE" },
            { status: 403 }
          )
        };
      }
    }

    const csrfToken = generateCsrfToken(sessionRes.csrfSecret!);

    return {
      auth: {
        user,
        session: sessionRes.session,
        csrfToken
      }
    };
  } catch (err: any) {
    console.error("requireAuth internal error:", err);
    return {
      errorResponse: NextResponse.json(
        { success: false, message: "Internal server error during authentication verification.", error: err.message },
        { status: 500 }
      )
    };
  }
}
