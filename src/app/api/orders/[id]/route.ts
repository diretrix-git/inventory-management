import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";
import { Product } from "@/models/Product";
import { requireRole } from "@/lib/auth-utils";
import { logAction } from "@/lib/audit";
import { auth } from "../../../../../auth";

// ─── GET /api/orders/[id] ─────────────────────────────────────────────────────
// All roles

export async function GET(
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

    const order = await Order.findById(id)
      .populate("createdBy", "name email")
      .lean();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (err) {
    console.error("[GET /api/orders/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── PUT /api/orders/[id] ─────────────────────────────────────────────────────
// Status transitions: pending→confirmed, pending→cancelled, confirmed→cancelled
// Cancellation restores stock and is Admin only

const updateOrderSchema = z.object({
  status: z.enum(["confirmed", "cancelled"]),
});

// Valid transitions map
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
  cancelled: [],
};

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 }
    );
  }

  const { status: newStatus } = parsed.data;

  // Cancellation requires Admin role
  if (newStatus === "cancelled") {
    const authResult = await requireRole(req, ["admin"]);
    if (authResult.response) return authResult.response;
  } else {
    // Confirmation — any authenticated user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Re-fetch session for audit log
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const order = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const currentStatus = order.status;
    const allowedTransitions = VALID_TRANSITIONS[currentStatus] ?? [];

    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition: ${currentStatus} → ${newStatus}. Allowed: ${allowedTransitions.join(", ") || "none"}`,
        },
        { status: 400 }
      );
    }

    order.status = newStatus;
    await order.save();

    // Restore stock on cancellation of a confirmed order
    if (newStatus === "cancelled" && currentStatus === "confirmed") {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { quantity: item.quantity },
        });
      }

      logAction({
        userId: session.user.id,
        userName: session.user.name ?? "Unknown",
        action: "order.cancelled",
        targetModel: "Order",
        targetId: order._id.toString(),
        details: { orderNumber: order.orderNumber, previousStatus: currentStatus },
      });
    } else {
      logAction({
        userId: session.user.id,
        userName: session.user.name ?? "Unknown",
        action: "order.updated",
        targetModel: "Order",
        targetId: order._id.toString(),
        details: { orderNumber: order.orderNumber, newStatus },
      });
    }

    return NextResponse.json({ order });
  } catch (err) {
    console.error("[PUT /api/orders/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
