import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/auth/callback",
  "/api/health",
  "/api/webhooks",
  "/api/embryology/nudges",
  "/api/seedscore/recalc-scheduled",
];

const PROTECTED_PREFIXES = [
  "/admin",
  "/bank",
  "/clinic",
  "/donor",
  "/recipient",
  "/portal",
];

function isPublicPath(pathname: string): boolean {
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/api/health")
  ) {
    return true;
  }
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return supabaseResponse;
  }

  if (isProtectedPath(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets.
     */
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
