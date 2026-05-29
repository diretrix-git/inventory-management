import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";
import { requireRole } from "@/lib/auth-utils";

// ─── GET /api/analytics ───────────────────────────────────────────────────────
// Admin only — date-range analytics from confirmed orders

export async function GET(req: NextRequest) {
  const authResult = await requireRole(req, ["admin"]);
  if (authResult.response) return authResult.response;

  const { searchParams } = req.nextUrl;
  const now = new Date();

  // Default: last 30 days
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);
  defaultStart.setHours(0, 0, 0, 0);

  let startDate = new Date(searchParams.get("startDate") ?? defaultStart.toISOString());
  let endDate = new Date(searchParams.get("endDate") ?? now.toISOString());

  // Reject future end dates
  if (endDate > now) endDate = now;
  if (startDate > now) startDate = defaultStart;

  endDate.setHours(23, 59, 59, 999);

  try {
    await connectDB();

    const matchStage = {
      status: "confirmed",
      createdAt: { $gte: startDate, $lte: endDate },
    };

    const [dailyData, categoryData, topProducts] = await Promise.all([
      // Daily revenue + orders
      Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Category breakdown
      Order.aggregate([
        { $match: matchStage },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ["$product.category", "Uncategorized"] },
            revenue: { $sum: "$items.lineTotal" },
            units: { $sum: "$items.quantity" },
          },
        },
        { $sort: { revenue: -1 } },
      ]),

      // Top 10 products by confirmed revenue
      Order.aggregate([
        { $match: matchStage },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            productName: { $first: "$items.productName" },
            sku: { $first: "$items.sku" },
            totalRevenue: { $sum: "$items.lineTotal" },
            totalQty: { $sum: "$items.quantity" },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
      ]),
    ]);

    // Compute category percentages
    const totalRevenue = categoryData.reduce((s: number, c: { revenue: number }) => s + c.revenue, 0);
    const categoryBreakdown = categoryData.map((c: { _id: string; revenue: number; units: number }) => ({
      ...c,
      percentage: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 10000) / 100 : 0,
    }));

    return NextResponse.json({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      dailyData,
      categoryBreakdown,
      topProducts,
      summary: {
        totalRevenue,
        totalOrders: dailyData.reduce((s: number, d: { orders: number }) => s + d.orders, 0),
      },
    });
  } catch (err) {
    console.error("[GET /api/analytics]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
