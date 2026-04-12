import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/register", "/survey", "/api/survey", "/api/auth"];
// These paths are accessible to any authenticated user; client-side guards handle unauthed access
const AUTH_ONLY_PATHS = ["/company-setup", "/help"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Auth-only paths pass through — no role required, client-side auth guards the page
  if (AUTH_ONLY_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("__session")?.value;
  const claimsCookie = request.cookies.get("__claims")?.value;

  let role: string | null = null;
  try {
    if (claimsCookie) {
      const claims = JSON.parse(atob(claimsCookie)) as { role?: string | null };
      role = claims.role ?? null;
    }
  } catch { /* malformed cookie — treat as unauthenticated */ }

  // /login: redirect already-authenticated users to their dashboard
  if (pathname === "/login") {
    if (sessionCookie) {
      if (role === "super_admin") return NextResponse.redirect(new URL("/admin", request.url));
      if (role === "field_agent") return NextResponse.redirect(new URL("/agent", request.url));
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Other public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // All remaining paths require a session
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based guards
  if (pathname.startsWith("/dashboard") && role !== "company_admin") {
    return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
  }
  if (pathname.startsWith("/admin") && role !== "super_admin") {
    return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
  }
  if (pathname.startsWith("/agent") && role !== "field_agent") {
    return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
