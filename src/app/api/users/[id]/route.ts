import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { requireRole } from "@/lib/auth-utils";
import { logAction } from "@/lib/audit";
import type { Role } from "@/types";

// ─── Validation schema ────────────────────────────────────────────────────────

const updateUserSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    role: z.enum(["admin", "staff"]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

// ─── PUT /api/users/[id] ──────────────────────────────────────────────────────
// Admin only — update a user; if deactivating, invalidate session

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRole(req, ["admin"]);
  if (authResult.response) return authResult.response;

  const { session } = authResult;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 }
    );
  }

  const updates = parsed.data;

  try {
    await connectDB();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const wasActive = user.isActive;
    const isDeactivating =
      updates.isActive === false && wasActive === true;

    // Apply updates
    if (updates.name !== undefined) user.name = updates.name;
    if (updates.role !== undefined) user.role = updates.role as Role;
    if (updates.isActive !== undefined) user.isActive = updates.isActive;

    await user.save();

    // Fire-and-forget audit log
    const action = isDeactivating ? "user.deactivated" : "user.updated";
    logAction({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action,
      targetModel: "User",
      targetId: user._id.toString(),
      details: updates,
    });

    // Return user without passwordHash
    const userObj = user.toObject() as unknown as Record<string, unknown>;
    delete userObj.passwordHash;

    return NextResponse.json({ user: userObj });
  } catch (err) {
    console.error("[PUT /api/users/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
