import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Supplier } from "@/models/Supplier";
import { Product } from "@/models/Product";
import { requireRole } from "@/lib/auth-utils";
import { logAction } from "@/lib/audit";

// ─── Validation schema ────────────────────────────────────────────────────────

const updateSupplierSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  contactPerson: z.string().min(1, "Contact person is required").max(100).optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().min(1, "Phone number is required").max(30).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().optional(),
});

// ─── PUT /api/suppliers/[id] ──────────────────────────────────────────────────
// Admin only — update a supplier

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

  const parsed = updateSupplierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 }
    );
  }

  const updates = parsed.data;

  try {
    await connectDB();

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Check name uniqueness if changing name
    if (updates.name && updates.name !== supplier.name) {
      const existing = await Supplier.findOne({ name: updates.name, _id: { $ne: id } }).lean();
      if (existing) {
        return NextResponse.json(
          { error: "A supplier with this name already exists" },
          { status: 409 }
        );
      }
    }

    Object.assign(supplier, updates);
    await supplier.save();

    logAction({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "supplier.updated",
      targetModel: "Supplier",
      targetId: supplier._id.toString(),
      details: updates,
    });

    return NextResponse.json({ supplier });
  } catch (err) {
    console.error("[PUT /api/suppliers/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE /api/suppliers/[id] ───────────────────────────────────────────────
// Admin only — delete a supplier (blocked if it has linked products)

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

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    const linkedProductCount = await Product.countDocuments({ supplierId: supplier._id });
    if (linkedProductCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete supplier with ${linkedProductCount} linked product(s)` },
        { status: 422 }
      );
    }

    await supplier.deleteOne();

    logAction({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "supplier.deleted",
      targetModel: "Supplier",
      targetId: id,
      details: { name: supplier.name },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/suppliers/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
