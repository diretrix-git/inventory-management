import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";
import { requireRole } from "@/lib/auth-utils";

// ─── GET /api/analytics ───────────────────────────────────────────────────────
// Admin only — comprehensive analytics

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

  if (endDate > now) endDate = now;
  if (startDate > now) startDate = defaultStart;
  endDate.setHours(23, 59, 59, 999);

  // Monthly revenue: last 12 months
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  // Weekly trend: last 7 days
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  try {
    await connectDB();

    const matchStage = {
      status: "confirmed" as const,
      createdAt: { $gte: startDate, $lte: endDate },
    };

    const [monthlyRevenue, topProducts, weeklyTrend, categoryData] = await Promise.all([
      // Monthly Revenue Chart — last 12 months
      Order.aggregate([
        { $match: { status: "confirmed", createdAt: { $gte: twelveMonthsAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            revenue: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Top Selling Products — by revenue in date range
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

      // Weekly Sales Trend — last 7 days, daily
      Order.aggregate([
        { $match: { status: "confirmed", createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Category Performance — revenue by category in date range
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
            orders: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
      ]),
    ]);

    // Compute category percentages
    const totalRevenue = categoryData.reduce((s: number, c: { revenue: number }) => s + c.revenue, 0);
    const categoryBreakdown = categoryData.map((c: { _id: string; revenue: number; units: number; orders: number }) => ({
      ...c,
      percentage: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 10000) / 100 : 0,
    }));

    // Summary for date range
    const rangeSummary = await Order.aggregate([
      { $match: matchStage },
      { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" }, totalOrders: { $sum: 1 } } },
    ]);

    return NextResponse.json({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      monthlyRevenue,
      topProducts,
      weeklyTrend,
      categoryBreakdown,
      summary: {
        totalRevenue: rangeSummary[0]?.totalRevenue ?? 0,
        totalOrders: rangeSummary[0]?.totalOrders ?? 0,
      },
    });
  } catch (err) {
    console.error("[GET /api/analytics]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
