import { auth } from "./auth";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

const STAFF_RESTRICTED_PATHS = [
  "/dashboard/analytics",
  "/dashboard/users",
  "/dashboard/settings",
  "/dashboard/audit-logs",
  "/dashboard/inventory-report",
  "/dashboard/sales-report",
  "/dashboard/categories",
];

// ─── Simple in-process rate limiter ──────────────────────────────────────────
// Protects the login endpoint: max 10 attempts per IP per 60 seconds.
// Note: on serverless each function instance has its own store — this is
// a best-effort mitigation; for production-grade limiting use Upstash Redis.

interface RateBucket {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateBucket>();
const LOGIN_MAX = 10;        // max attempts
const LOGIN_WINDOW_MS = 60_000; // 60 seconds

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = loginAttempts.get(ip);

  if (!bucket || now > bucket.resetAt) {
    // New window
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }

  bucket.count++;
  if (bucket.count > LOGIN_MAX) {
    return true;
  }
  return false;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export default auth((req: NextAuthRequest) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;
  const pathname = nextUrl.pathname;
  const method = req.method;

  // ── Rate limit login attempts ────────────────────────────────────────────
  // POST to /api/auth/callback/credentials = a login attempt
  if (
    method === "POST" &&
    pathname === "/api/auth/callback/credentials"
  ) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      return new NextResponse(
        JSON.stringify({ error: "Too many login attempts. Please wait 60 seconds and try again." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
            "X-RateLimit-Limit": String(LOGIN_MAX),
          },
        }
      );
    }
  }

  // ── Auth guard for dashboard pages ───────────────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }

    // Redirect Staff away from restricted paths
    const userRole = session?.user?.role;
    if (userRole === "staff") {
      const isRestricted = STAFF_RESTRICTED_PATHS.some((path) =>
        pathname.startsWith(path)
      );
      if (isRestricted) {
        return NextResponse.redirect(new URL("/unauthorized", nextUrl));
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Include API auth route for rate limiting + all non-static pages
    "/api/auth/callback/credentials",
    "/((?!api|_next/static|_next/image|favicon\\.ico|login|unauthorized).*)",
  ],
};
