import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { auth } from "../../../../auth";

// ─── GET /api/notifications ───────────────────────────────────────────────────
// Returns notifications for the current user (by userId or role)

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const notifications = await Notification.find({
      $or: [
        { userId: session.user.id },
        { role: session.user.role },
        { role: "all" },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = notifications.filter((n) => !n.read).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    console.error("[GET /api/notifications]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── PUT /api/notifications ───────────────────────────────────────────────────
// Mark all as read for current user

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    await Notification.updateMany(
      {
        $or: [
          { userId: session.user.id },
          { role: session.user.role },
          { role: "all" },
        ],
        read: false,
      },
      { $set: { read: true } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PUT /api/notifications]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
