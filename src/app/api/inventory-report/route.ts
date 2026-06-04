import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { requireRole } from "@/lib/auth-utils";

// ─── GET /api/inventory-report ────────────────────────────────────────────────
// Admin only — all products with stock value + aggregate total

export async function GET(req: NextRequest) {
  const authResult = await requireRole(req, ["admin"]);
  if (authResult.response) return authResult.response;

  try {
    await connectDB();

    const docs = await Product.find({}).populate("supplierId", "name").sort({ name: 1 });
    const products = docs.map((d) => {
      const obj = d.toObject({ virtuals: true }) as {
        price: number;
        quantity: number;
        lowStockThreshold: number;
        isLowStock?: boolean;
        supplierId?: { _id: unknown; name?: string } | null;
        [key: string]: unknown;
      };
      const supplier = obj.supplierId as { _id: unknown; name?: string } | null;
      return {
        ...obj,
        supplierName: supplier?.name ?? null,
        supplierId: supplier?._id ? String(supplier._id) : null,
        totalStockValue: obj.price * obj.quantity,
        stockStatus: obj.isLowStock ? "low" : "ok",
      };
    });

    const totalInventoryValue = products.reduce((sum, p) => sum + p.totalStockValue, 0);

    return NextResponse.json({ products, totalInventoryValue });
  } catch (err) {
    console.error("[GET /api/inventory-report]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
