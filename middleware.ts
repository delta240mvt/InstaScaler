import type { NextRequest } from "next/server";
import { protectWebRoute } from "@/lib/web-route-protection";

export function middleware(request: NextRequest) {
  return protectWebRoute(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/overview/:path*", "/campaigns/:path*", "/automations/:path*", "/inbox/:path*", "/logs/:path*", "/diagnostics/:path*", "/settings/:path*", "/login"],
};
