import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";
import { requireRole } from "@/lib/auth-utils";

// ─── GET /api/sales-report ────────────────────────────────────────────────────
// Admin only — sales summary + line items for confirmed orders in date range

export async function GET(req: NextRequest) {
  const authResult = await requireRole(req, ["admin"]);
  if (authResult.response) return authResult.response;

  const { searchParams } = req.nextUrl;
  const now = new Date();

  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);
  defaultStart.setHours(0, 0, 0, 0);

  let startDate = new Date(searchParams.get("startDate") ?? defaultStart.toISOString());
  let endDate = new Date(searchParams.get("endDate") ?? now.toISOString());

  if (endDate > now) endDate = now;
  endDate.setHours(23, 59, 59, 999);

  try {
    await connectDB();

    const matchStage = {
      status: "confirmed" as const,
      createdAt: { $gte: startDate, $lte: endDate },
    };

    const orders = await Order.find(matchStage).sort({ createdAt: -1 }).lean();

    const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Distinct SKUs sold
    const skuSet = new Set<string>();
    for (const order of orders) {
      for (const item of order.items) {
        skuSet.add(item.sku);
      }
    }

    return NextResponse.json({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        distinctSkus: skuSet.size,
      },
      orders,
    });
  } catch (err) {
    console.error("[GET /api/sales-report]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
