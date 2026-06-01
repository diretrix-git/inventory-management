import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";
import { Product } from "@/models/Product";
import { Invoice } from "@/models/Invoice";
import { SystemSettings } from "@/models/SystemSettings";
import { requireRole } from "@/lib/auth-utils";
import { logAction } from "@/lib/audit";
import { generateOrderNumber, generateInvoiceNumber } from "@/lib/order-utils";
import { sendOrderEmails } from "@/lib/email";
import { notify } from "@/lib/notify";
import { auth } from "../../../../auth";
import mongoose from "mongoose";

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

  const { customerName, customerEmail, items, notes } = parsed.data;

  try {
    await connectDB();

    // Fetch all products in the cart
    const productIds = items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } });

    // Validate all products exist
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "One or more products not found" }, { status: 400 });
    }

    // Validate stock availability
    const outOfStock: string[] = [];
    for (const item of items) {
      const product = products.find((p) => String(p._id) === item.productId);
      if (!product) continue;
      if (product.quantity < item.quantity) {
        outOfStock.push(`${product.name} (available: ${product.quantity}, requested: ${item.quantity})`);
      }
    }
    if (outOfStock.length > 0) {
      return NextResponse.json(
        { error: `Insufficient stock: ${outOfStock.join("; ")}` },
        { status: 400 }
      );
    }

    // Get system settings for tax rate and business info
    const settings = await SystemSettings.findOne({}).lean() ?? {
      taxRate: 0,
      businessName: "My Business",
      businessAddress: "",
    };

    const now = new Date();
    const [orderNumber, invoiceNumber] = await Promise.all([
      generateOrderNumber(now),
      generateInvoiceNumber(now),
    ]);

    // Build order lines
    const orderItems = items.map((item) => {
      const product = products.find((p) => String(p._id) === item.productId)!;
      const lineTotal = product.price * item.quantity;
      return {
        productId: product._id,
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitPrice: product.price,
        lineTotal,
      };
    });

    const subtotal = orderItems.reduce((sum, l) => sum + l.lineTotal, 0);
    const taxRate = settings.taxRate / 100;
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    // ── Approval threshold ───────────────────────────────────────────────────
    // Orders ≥ 15,000 require admin approval — stock is NOT deducted until approved
    const APPROVAL_THRESHOLD = 15000;
    const requiresApproval = totalAmount >= APPROVAL_THRESHOLD;
    // Auto-confirm orders below threshold
    const initialStatus = requiresApproval ? "pending" : "confirmed";

    // ── MongoDB transaction ──────────────────────────────────────────────────
    const dbSession = await mongoose.startSession();
    let order: InstanceType<typeof Order> | null = null;

    try {
      await dbSession.withTransaction(async () => {
        // 1. Create order
        const [createdOrder] = await Order.create(
          [
            {
              orderNumber,
              items: orderItems,
              subtotal,
              taxRate: settings.taxRate,
              taxAmount,
              totalAmount,
              status: initialStatus,
              requiresApproval,
              customerName: customerName.trim(),
              customerEmail: customerEmail?.trim() || undefined,
              notes,
              createdBy: session.user.id,
            },
          ],
          { session: dbSession }
        );
        order = createdOrder;

        // 2. Deduct stock ONLY for auto-confirmed orders (below threshold)
        //    For orders requiring approval, stock is deducted when admin confirms
        if (!requiresApproval) {
          for (const item of items) {
            await Product.findByIdAndUpdate(
              item.productId,
              { $inc: { quantity: -item.quantity } },
              { session: dbSession }
            );
          }
        }

        // 3. Create invoice snapshot (always — even for pending approval orders)
        await Invoice.create(
          [
            {
              invoiceNumber,
              orderId: createdOrder._id,
              issuedTo: customerName.trim(),
              items: orderItems.map((l) => ({
                productName: l.productName,
                sku: l.sku,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                lineTotal: l.lineTotal,
              })),
              subtotal,
              taxRate: settings.taxRate,
              taxAmount,
              totalAmount,
              status: "issued",
            },
          ],
          { session: dbSession }
        );
      });
    } finally {
      await dbSession.endSession();
    }

    if (!order) {
      return NextResponse.json({ error: "Order creation failed" }, { status: 500 });
    }

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
      taxRate: settings.taxRate,
      taxAmount,
      totalAmount,
      businessName: settings.businessName ?? "My Business",
      businessAddress: settings.businessAddress ?? "",
    });

    return NextResponse.json({
      order,
      requiresApproval,
      message: requiresApproval
        ? `Order ${orderNumber} submitted for admin approval (total ≥ ₹15,000). Stock will be reserved once approved.`
        : `Order ${orderNumber} confirmed automatically.`,
    }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/orders]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
