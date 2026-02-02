// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ------------------------------------------------------------------
  // 🔒 Protect admin routes
  // ------------------------------------------------------------------
  if (pathname.startsWith("/admin")) {
    // Allow access to login page itself
    if (pathname === "/admin/login") {
      return NextResponse.next();
    }

    const auth = req.cookies.get("admin_auth");

    if (!auth || auth.value !== "1") {
      const url = new URL("/admin/login", req.url);
      return NextResponse.redirect(url);
    }
  }

  // ------------------------------------------------------------------
  // Everything else
  // ------------------------------------------------------------------
  return NextResponse.next();
}

// Only run middleware where needed
export const config = {
  matcher: ["/admin/:path*"],
};
