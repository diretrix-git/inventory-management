import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { requireRole } from "@/lib/auth-utils";
import { logAction } from "@/lib/audit";
import { auth } from "../../../../auth";

// ─── Validation schema ────────────────────────────────────────────────────────

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(50),
  category: z.string().max(100).optional(),
  description: z.string().optional(),
  price: z.number().min(0),
  quantity: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).default(10),
  supplierId: z.string().optional(),
  imageUrl: z.string().optional(),
});

// ─── GET /api/products ────────────────────────────────────────────────────────
// All roles — return all products with isLowStock virtual

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    // toJSON virtuals are enabled on the schema, so lean() won't include them.
    // Fetch as documents and convert with toObject({ virtuals: true }).
    const docs = await Product.find({}).sort({ createdAt: -1 });
    const products = docs.map((d) => d.toObject({ virtuals: true }));
    return NextResponse.json({ products });
  } catch (err) {
    console.error("[GET /api/products]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/products ───────────────────────────────────────────────────────
// Admin only — create a product

export async function POST(req: NextRequest) {
  const authResult = await requireRole(req, ["admin"]);
  if (authResult.response) return authResult.response;
  const { session } = authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const sku = data.sku.toUpperCase();

  try {
    await connectDB();

    const existing = await Product.findOne({ sku }).lean();
    if (existing) {
      return NextResponse.json(
        { error: "A product with this SKU already exists" },
        { status: 409 }
      );
    }

    const product = await Product.create({ ...data, sku });

    logAction({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "product.created",
      targetModel: "Product",
      targetId: product._id.toString(),
      details: { name: product.name, sku: product.sku },
    });

    return NextResponse.json(
      { product: product.toObject({ virtuals: true }) },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/products]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
