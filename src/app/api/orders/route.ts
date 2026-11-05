import { createOrder, OrderError } from "@/lib/order-service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";
import { logAction } from "@/lib/audit";
import { sendOrderEmails } from "@/lib/email";
import { notify } from "@/lib/notify";
import { auth } from "../../../../auth";

// ─── GET /api/orders ──────────────────────────────────────────────────────────
// All roles — paginated, searchable

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "25", 10)));
    const search = searchParams.get("search") ?? "";
    const skip = (page - 1) * limit;

    const query = search
      ? {
          $or: [
            { orderNumber: { $regex: search, $options: "i" } },
            { customerName: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name email")
        .lean(),
      Order.countDocuments(query),
    ]);

    return NextResponse.json({
      orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[GET /api/orders]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/orders ─────────────────────────────────────────────────────────
// All roles — atomic order creation with MongoDB transaction

const orderLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
});

const createOrderSchema = z.object({
  customerName: z
    .string()
    .min(1, "Customer name is required")
    .max(200, "Customer name too long")
    .refine((v) => v.trim().length > 0, "Customer name cannot be whitespace only"),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  items: z.array(orderLineSchema).min(1, "Order must contain at least one item"),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
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

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 }
    );
  }

  const { customerName, customerEmail } = parsed.data;

  try {
    await connectDB();

    const result = await createOrder({ ...parsed.data, idempotencyKey: req.headers.get("Idempotency-Key") ?? "" }, session.user.id);
    const { order } = result;
    if (result.replayed) {
      return NextResponse.json({ order, requiresApproval: order.requiresApproval, replayed: true });
    }
    const { orderNumber, totalAmount, requiresApproval, items: orderItems, subtotal, taxRate, taxAmount } = order;
    const { invoiceNumber, settings } = result;

    // Fire-and-forget notifications
    if (requiresApproval) {
      // Notify all admins that a high-value order needs approval
      notify({
        userId: "admin",
        role: "admin",
        type: "order_created",
        title: "Order Requires Approval",
        message: `Order ${orderNumber} from ${customerName.trim()} totals ₹Rs {totalAmount.toFixed(2)} and needs your approval.`,
        link: "/orders",
      });
    } else {
      // Notify admins of new auto-confirmed order
      notify({
        userId: "admin",
        role: "admin",
        type: "order_created",
        title: "New Order Confirmed",
        message: `Order ${orderNumber} from ${customerName.trim()} (₹Rs {totalAmount.toFixed(2)}) was auto-confirmed.`,
        link: "/orders",
      });
    }

    // Fire-and-forget audit log
    logAction({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "order.created",
      targetModel: "Order",
      targetId: (order as InstanceType<typeof Order>)._id.toString(),
      details: { orderNumber, customerName, totalAmount },
    });

    // Fire-and-forget email notifications (customer + admin)
    sendOrderEmails({
      orderNumber,
      invoiceNumber,
      customerName: customerName.trim(),
      customerEmail: customerEmail?.trim() || undefined,
      items: orderItems,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      businessName: settings?.businessName ?? "My Business",
      businessAddress: settings?.businessAddress ?? "",
    });

    return NextResponse.json({
      order,
      requiresApproval,
      message: requiresApproval
        ? `Order ${orderNumber} submitted for admin approval (total ≥ ₹15,000). Stock will be reserved once approved.`
        : `Order ${orderNumber} confirmed automatically.`,
    }, { status: 201 });
  } catch (err) {
    if (err instanceof OrderError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[POST /api/orders]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
