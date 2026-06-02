import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { requireRole } from "@/lib/auth-utils";
import { auth } from "../../../../auth";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Too long"),
  description: z.string().max(300).optional(),
});

// ─── GET /api/categories ──────────────────────────────────────────────────────
// All roles — return all categories with product counts

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const [dbCategories, productCounts] = await Promise.all([
      Category.find({}).sort({ name: 1 }).lean(),
      Product.aggregate([
        { $match: { category: { $exists: true, $ne: "" } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = new Map(productCounts.map((p: { _id: string; count: number }) => [p._id, p.count]));

    // Also include categories from products that aren't in the Category collection yet
    // (legacy data migration support)
    const productOnlyCategories = productCounts
      .map((p: { _id: string }) => p._id)
      .filter((name: string) => !dbCategories.some((c) => c.name === name));

    const categories = [
      ...dbCategories.map((c) => ({
        _id: String(c._id),
        name: c.name,
        description: c.description,
        productCount: countMap.get(c.name) ?? 0,
        createdAt: c.createdAt,
      })),
      ...productOnlyCategories.map((name: string) => ({
        _id: `legacy-${name}`,
        name,
        description: undefined,
        productCount: countMap.get(name) ?? 0,
        createdAt: new Date(0),
      })),
    ].sort((a, b) => a.name.localeCompare(b.name));

    // Also return flat array for backward compatibility with CategorySelect
    return NextResponse.json({
      categories: categories.map((c) => c.name),
      categoriesWithMeta: categories,
    });
  } catch (err) {
    console.error("[GET /api/categories]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/categories ─────────────────────────────────────────────────────
// Admin only — create a category

export async function POST(req: NextRequest) {
  const authResult = await requireRole(req, ["admin"]);
  if (authResult.response) return authResult.response;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 });
  }

  try {
    await connectDB();
    const existing = await Category.findOne({ name: { $regex: `^${parsed.data.name}$`, $options: "i" } });
    if (existing) {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }
    const category = await Category.create(parsed.data);
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/categories]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
