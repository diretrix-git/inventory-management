import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { requireRole } from "@/lib/auth-utils";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(300).optional(),
});

// ─── PUT /api/categories/[id] ─────────────────────────────────────────────────
// Admin only — rename a category (also updates all products using it)

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRole(req, ["admin"]);
  if (authResult.response) return authResult.response;

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 });
  }

  try {
    await connectDB();
    const category = await Category.findById(id);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const oldName = category.name;

    if (parsed.data.name && parsed.data.name !== oldName) {
      // Check uniqueness
      const existing = await Category.findOne({
        name: { $regex: `^${parsed.data.name}$`, $options: "i" },
        _id: { $ne: id },
      });
      if (existing) {
        return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
      }
      // Update all products using the old category name
      await Product.updateMany({ category: oldName }, { $set: { category: parsed.data.name } });
      category.name = parsed.data.name;
    }

    if (parsed.data.description !== undefined) category.description = parsed.data.description;
    await category.save();

    return NextResponse.json({ category });
  } catch (err) {
    console.error("[PUT /api/categories/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE /api/categories/[id] ─────────────────────────────────────────────
// Admin only — delete a category (clears it from all products)

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRole(req, ["admin"]);
  if (authResult.response) return authResult.response;

  const { id } = await params;

  try {
    await connectDB();
    const category = await Category.findById(id);
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const productCount = await Product.countDocuments({ category: category.name });
    if (productCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete — ${productCount} product(s) use this category. Reassign them first.` },
        { status: 422 }
      );
    }

    await category.deleteOne();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/categories/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
