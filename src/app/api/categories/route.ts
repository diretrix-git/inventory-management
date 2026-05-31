import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { auth } from "../../../../auth";

// ─── GET /api/categories ──────────────────────────────────────────────────────
// All roles — return distinct category values from products

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    // Get all distinct non-empty category values
    const categories = await Product.distinct("category", {
      category: { $exists: true, $ne: "" },
    });
    return NextResponse.json({ categories: (categories as string[]).sort() });
  } catch (err) {
    console.error("[GET /api/categories]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
