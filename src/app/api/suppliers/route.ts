import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Supplier } from "@/models/Supplier";
import { Product } from "@/models/Product";
import { requireRole } from "@/lib/auth-utils";
import { logAction } from "@/lib/audit";
import { auth } from "../../../../auth";

// ─── Validation schema ────────────────────────────────────────────────────────

const createSupplierSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  contactPerson: z.string().min(1, "Contact person is required").max(100),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().min(1, "Phone number is required").max(30),
  address: z.string().max(500).optional(),
  notes: z.string().optional(),
});

// ─── GET /api/suppliers ───────────────────────────────────────────────────────
// All roles — return all suppliers with linked product count

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const suppliers = await Supplier.find({}).sort({ name: 1 }).lean();

    // Get product counts per supplier
    const supplierIds = suppliers.map((s) => s._id);
    const productCounts = await Product.aggregate([
      { $match: { supplierId: { $in: supplierIds } } },
      { $group: { _id: "$supplierId", count: { $sum: 1 } } },
    ]);

    const countMap = new Map(productCounts.map((pc) => [String(pc._id), pc.count as number]));

    const result = suppliers.map((s) => ({
      ...s,
      productCount: countMap.get(String(s._id)) ?? 0,
    }));

    return NextResponse.json({ suppliers: result });
  } catch (err) {
    console.error("[GET /api/suppliers]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/suppliers ──────────────────────────────────────────────────────
// Admin only — create a supplier

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

  const parsed = createSupplierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation error" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    await connectDB();

    const existing = await Supplier.findOne({ name: data.name }).lean();
    if (existing) {
      return NextResponse.json(
        { error: "A supplier with this name already exists" },
        { status: 409 }
      );
    }

    const supplier = await Supplier.create(data);

    logAction({
      userId: session.user.id,
      userName: session.user.name ?? "Unknown",
      action: "supplier.created",
      targetModel: "Supplier",
      targetId: supplier._id.toString(),
      details: { name: supplier.name },
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/suppliers]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
