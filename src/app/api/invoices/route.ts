import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Invoice } from "@/models/Invoice";
import { auth } from "../../../../auth";

// ─── GET /api/invoices ────────────────────────────────────────────────────────
// All roles — paginated, default 25 rows

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
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      Invoice.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("orderId", "orderNumber")
        .lean(),
      Invoice.countDocuments(),
    ]);

    return NextResponse.json({
      invoices,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[GET /api/invoices]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
