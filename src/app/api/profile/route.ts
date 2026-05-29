import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "../../../../auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

// ─── Validation schema ────────────────────────────────────────────────────────

const updateProfileSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8).optional(),
  })
  .refine(
    (data) => {
      // If newPassword is provided, currentPassword must also be provided
      if (data.newPassword && !data.currentPassword) return false;
      return true;
    },
    {
      message: "Current password is required when setting a new password",
      path: ["currentPassword"],
    }
  );

// ─── PUT /api/profile ─────────────────────────────────────────────────────────
// Any authenticated role — update own name and/or password

export async function PUT(req: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 }
    );
  }

  const { name, currentPassword, newPassword } = parsed.data;

  // Must provide at least one field to update
  if (!name && !newPassword) {
    return NextResponse.json(
      { error: "At least one field must be provided" },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update name if provided
    if (name !== undefined) {
      user.name = name;
    }

    // Update password if requested
    if (newPassword) {
      // currentPassword is guaranteed by the zod refinement above
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required when setting a new password" },
          { status: 400 }
        );
      }

      if (!user.passwordHash) {
        return NextResponse.json(
          {
            error:
              "Password change is not available for OAuth-authenticated accounts",
          },
          { status: 400 }
        );
      }

      const isCorrect = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCorrect) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }

      user.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    await user.save();

    // Return updated user without passwordHash
    const userObj = user.toObject() as unknown as Record<string, unknown>;
    delete userObj.passwordHash;

    return NextResponse.json({ user: userObj });
  } catch (err) {
    console.error("[PUT /api/profile]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
