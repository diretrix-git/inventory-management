import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { auth } from "../../../../../auth";

// ─── PATCH /api/notifications/[id] ───────────────────────────────────────────
// Mark single notification as read

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectDB();
    await Notification.findByIdAndUpdate(id, { $set: { read: true } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/notifications/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
