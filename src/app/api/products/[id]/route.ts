import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { Order } from "@/models/Order";
import { requireRole } from "@/lib/auth-utils";
import { logAction } from "@/lib/audit";

// ─── Validation schema ────────────────────────────────────────────────────────

const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  // SKU is intentionally excluded from updates — it's set at creation and
  // referenced by orders/invoices. Changing it would break historical records.
  category: z.string().max(100).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  quantity: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  supplierId: z.string().nullable().optional(),
  imageUrl: z.string().optional(),
});

// ─── PUT /api/products/[id] ───────────────────────────────────────────────────
// Admin only — update a product

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

  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 }
    );
  }

  const updates = parsed.data;

  try {
    await connectDB();

    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    Object.assign(product, updates);
    await product.save();

    logAction({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "product.updated",
      targetModel: "Product",
      targetId: product._id.toString(),
      details: updates,
    });

    return NextResponse.json({ product: product.toObject({ virtuals: true }) });
  } catch (err) {
    console.error("[PUT /api/products/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE /api/products/[id] ────────────────────────────────────────────────
// Admin only — delete a product (blocked if referenced by confirmed orders)

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRole(req, ["admin"]);
  if (authResult.response) return authResult.response;
  const { session } = authResult;

  const { id } = await params;

  try {
    await connectDB();

    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Block delete if any confirmed order references this product
    const confirmedOrderCount = await Order.countDocuments({
      status: "confirmed",
      "items.productId": product._id,
    });

    if (confirmedOrderCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete product referenced by confirmed orders" },
        { status: 422 }
      );
    }

    await product.deleteOne();

    logAction({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "product.deleted",
      targetModel: "Product",
      targetId: id,
      details: { name: product.name, sku: product.sku },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/products/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
