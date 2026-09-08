import { NextResponse, type NextRequest } from "next/server";

export const PROTECTED_PREFIXES = ["/dashboard", "/overview", "/campaigns", "/automations", "/inbox", "/logs", "/diagnostics", "/settings"];

export function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.has("__Host-instascaler-session");
}

export function protectWebRoute(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const authenticated = hasSessionCookie(request);
  if (protectedRoute && !authenticated) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }
  // Cookie presence cannot prove validity. Core verifies the session; login must
  // remain reachable when a stored cookie has expired or is invalid.
  return NextResponse.next();
}

export const webRouteMatcher = ["/dashboard/:path*", "/overview/:path*", "/campaigns/:path*", "/automations/:path*", "/inbox/:path*", "/logs/:path*", "/diagnostics/:path*", "/settings/:path*", "/login"];
