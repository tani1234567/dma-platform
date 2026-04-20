import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/register", "/survey", "/api/survey", "/api/auth"];
// These paths are accessible to any authenticated user; client-side guards handle unauthed access
const AUTH_ONLY_PATHS = ["/company-setup", "/help"];

function dashboardForRole(role: string | null): string {
  if (role === "super_admin") return "/admin";
  if (role === "field_agent") return "/agent";
  return "/dashboard";
}

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

  let role: string | null = null;
  try {
    if (sessionCookie) {
      const session = JSON.parse(atob(sessionCookie)) as { uid?: string; role?: string | null };
      role = session.role ?? null;
    }
  } catch { /* malformed cookie — treat role as unknown */ }

  // Root ("/") — show landing page to guests, send authenticated users to their dashboard
  if (pathname === "/") {
    if (sessionCookie) {
      return NextResponse.redirect(new URL(dashboardForRole(role), request.url));
    }
    return NextResponse.next();
  }

  // /login — redirect already-authenticated users to their dashboard
  if (pathname === "/login") {
    if (sessionCookie) {
      return NextResponse.redirect(new URL(dashboardForRole(role), request.url));
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

  // Role-based guards — only enforce when role is known; if __session couldn't be decoded
  // the client-side AuthProvider will re-establish the correct state on next login.
  if (pathname.startsWith("/dashboard") && role !== null && role !== "company_admin") {
    return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
  }
  if (pathname.startsWith("/admin") && role !== null && role !== "super_admin") {
    return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
  }
  if (pathname.startsWith("/agent") && role !== null && role !== "field_agent") {
    return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
