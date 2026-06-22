import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { requireRole } from "@/lib/auth-utils";
import { logAction } from "@/lib/audit";

// ─── POST /api/users/[id]/unlock ──────────────────────────────────────────────
// Admin only — unlock a locked account and reset failed login attempts

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRole(req, ["admin"]);
  if (authResult.response) return authResult.response;
  const { session } = authResult;

  const { id } = await params;

  try {
    await connectDB();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    user.loginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    logAction({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "user.unlocked",
      targetModel: "User",
      targetId: id,
      details: { email: user.email },
    });

    return NextResponse.json({ success: true, message: `Account unlocked for ${user.name}` });
  } catch (err) {
    console.error("[POST /api/users/[id]/unlock]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
