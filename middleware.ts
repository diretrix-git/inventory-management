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

export default auth((req: NextAuthRequest) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;
  const pathname = nextUrl.pathname;

  // Redirect unauthenticated users away from dashboard
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
    "/((?!api|_next/static|_next/image|favicon\\.ico|login|unauthorized).*)",
  ],
};
