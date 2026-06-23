import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";
import { Product } from "@/models/Product";
import { requireRole } from "@/lib/auth-utils";
import { logAction } from "@/lib/audit";
import { notify } from "@/lib/notify";
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

  // Cancellation requires Admin role; confirmation also requires Admin for high-value orders
  if (newStatus === "cancelled") {
    const authResult = await requireRole(req, ["admin"]);
    if (authResult.response) return authResult.response;
  } else {
    // Confirmation — require admin (they're approving the order)
    const authResult = await requireRole(req, ["admin"]);
    if (authResult.response) return authResult.response;
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

    // When admin confirms a high-value order (requiresApproval=true), deduct stock NOW
    if (newStatus === "confirmed" && (order as unknown as { requiresApproval?: boolean }).requiresApproval) {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { quantity: -item.quantity },
        });
      }
      // Notify the order creator that their order was approved
      notify({
        userId: String(order.createdBy),
        role: "staff",
        type: "order_approved",
        title: "Order Approved",
        message: `Your order ${order.orderNumber} (Rs ${order.totalAmount.toFixed(2)}) has been approved and stock has been reserved.`,
        link: "/orders",
      });
      logAction({
        userId: session.user.id,
        userName: session.user.name ?? "Unknown",
        action: "order.approved",
        targetModel: "Order",
        targetId: order._id.toString(),
        details: { orderNumber: order.orderNumber, totalAmount: order.totalAmount },
      });
    }
    // Restore stock on cancellation of a confirmed order (stock was already deducted)
    else if (newStatus === "cancelled" && currentStatus === "confirmed") {
      // Stock was deducted when the order reached "confirmed" status, so always restore it
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { quantity: item.quantity },
        });
      }
      // Notify the order creator of cancellation
      notify({
        userId: String(order.createdBy),
        role: "staff",
        type: "order_cancelled",
        title: "Order Cancelled",
        message: `Order ${order.orderNumber} has been cancelled.`,
        link: "/orders",
      });
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
