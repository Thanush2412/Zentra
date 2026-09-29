import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge Proxy / Middleware for /api/* routes
 *
 * Fast edge presence verification:
 * 1. Allows public unauthenticated routes.
 * 2. Checks presence of `ecampus_session` cookie on protected API routes.
 * 3. Individual sensitive API routes independently enforce full database session validation,
 *    60-minute idle inactivity timeout, and live role/permission checks via `requireAuth()`.
 */

const SESSION_COOKIE_NAME = "ecampus_session";

/** Endpoints reachable without an active session cookie. */
const PUBLIC_PATHS = new Set<string>([
  "/api/login",
  "/api/signup",
  "/api/change-password",
  "/api/health",
  "/api/student-feedback",
  "/api/auth/me",
  "/api/data/reference"
]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token || token.trim().length === 0) {
    return NextResponse.json(
      { success: false, message: "Unauthorized: missing session token.", code: "NO_SESSION" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"]
};
