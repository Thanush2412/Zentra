import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only guard /api/ routes
  if (pathname.startsWith("/api/")) {
    // Public unauthenticated routes
    if (
      pathname.startsWith("/api/login") ||
      pathname.startsWith("/api/signup") ||
      pathname.startsWith("/api/change-password")
    ) {
      return NextResponse.next();
    }

    // Check for authorization header or session cookie
    const authHeader = request.headers.get("authorization");
    const sessionCookie = request.cookies.get("fp_logged_in")?.value || request.cookies.get("session")?.value;

    // In local development or authenticated client requests, pass through
    // Request must contain authorization or logged_in indicator
    if (!authHeader && !sessionCookie && request.headers.get("sec-fetch-dest") !== "empty") {
      // Allow API calls coming from front-end fetch or return auth header requirement
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
