import { auth } from "../../auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import type { Role } from "@/types";

type RequireRoleResult =
  | { session: Session; response?: never }
  | { session?: never; response: NextResponse };

/**
 * Validates the current session and checks that the user holds one of the
 * allowed roles.
 *
 * Returns `{ session }` when the caller is authorised, or a `{ response }`
 * containing the appropriate HTTP error (401 / 403) when they are not.
 *
 * Requirements: 1.7, 15.2
 */
export async function requireRole(
  // req is accepted for API symmetry and future use (e.g. logging), but
  // auth() in Auth.js v5 reads the session from the request context itself.
  _req: NextRequest,
  allowedRoles: Role[]
): Promise<RequireRoleResult> {
  const session = await auth();

  if (!session?.user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const userRole = session.user.role as Role;

  if (!allowedRoles.includes(userRole)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { session };
}
