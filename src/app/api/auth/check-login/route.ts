import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// ─── POST /api/auth/check-login ───────────────────────────────────────────────
// Pre-validates credentials and returns user-friendly error messages.
// This runs BEFORE Auth.js signIn() so we can return the real error reason.
// Auth.js strips custom error messages from authorize() — this works around that.

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  try {
    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase() });

    // Generic message — never reveal if email exists
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }

    // Check temporary lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const mins = Math.ceil(remainingMs / 60000);
      return NextResponse.json({
        error: `Too many failed login attempts. Account is locked. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`,
      }, { status: 423 }); // 423 Locked
    }

    // Check permanently deactivated
    if (!user.isActive) {
      return NextResponse.json({
        error: "Account disabled. Please contact your administrator.",
      }, { status: 403 });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      const newAttempts = (user.loginAttempts ?? 0) + 1;
      if (newAttempts >= MAX_ATTEMPTS) {
        user.loginAttempts = newAttempts;
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
        await user.save();
        return NextResponse.json({
          error: `Too many failed login attempts. Account locked for 15 minutes.`,
        }, { status: 423 });
      }
      const remaining = MAX_ATTEMPTS - newAttempts;
      user.loginAttempts = newAttempts;
      await user.save();
      return NextResponse.json({
        error: `Email or password is incorrect. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining before account lockout.`,
      }, { status: 401 });
    }

    // Valid credentials — return 200 (Auth.js will handle actual session creation)
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/auth/check-login]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
