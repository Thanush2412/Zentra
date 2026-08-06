import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
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
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
