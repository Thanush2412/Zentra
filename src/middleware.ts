import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let public endpoints pass through
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Only guard /api/ routes
  if (pathname.startsWith("/api/")) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!token || token.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "Unauthorized: missing session token.", code: "NO_SESSION" },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"]
};
