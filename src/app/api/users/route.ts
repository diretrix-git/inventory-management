import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { requireRole } from "@/lib/auth-utils";
import { logAction } from "@/lib/audit";
import type { Role } from "@/types";

// ─── Validation schema ────────────────────────────────────────────────────────

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["admin", "staff"]),
});

// ─── GET /api/users ───────────────────────────────────────────────────────────
// Admin only — return all users paginated, passwordHash excluded

export async function GET(req: NextRequest) {
  const authResult = await requireRole(req, ["admin"]);
  if (authResult.response) return authResult.response;

  try {
    await connectDB();

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "25", 10))
    );
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({}, { passwordHash: 0 })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("[GET /api/users]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/users ──────────────────────────────────────────────────────────
// Admin only — create a new user

export async function POST(req: NextRequest) {
  const authResult = await requireRole(req, ["admin"]);
  if (authResult.response) return authResult.response;

  const { session } = authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 }
    );
  }

  const { name, email, password, role } = parsed.data;

  try {
    await connectDB();

    // Check email uniqueness
    const existing = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: role as Role,
      isActive: true,
    });

    // Fire-and-forget audit log
    logAction({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "user.created",
      targetModel: "User",
      targetId: user._id.toString(),
      details: { name, email: user.email, role },
    });

    // Return user without passwordHash
    const { passwordHash: _ph, ...userWithoutHash } = user.toObject();
    void _ph;

    return NextResponse.json({ user: userWithoutHash }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/users]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
