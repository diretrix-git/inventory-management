import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";
import { Invoice } from "@/models/Invoice";
import { Product } from "@/models/Product";
import { auth } from "../../../../auth";

// ─── GET /api/dashboard ───────────────────────────────────────────────────────
// All roles — aggregated dashboard data

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // ── Stat cards ────────────────────────────────────────────────────────────

    const [
      monthlyRevenueResult,
      monthlyOrderCount,
      activeProductCount,
      lowStockProducts,
      recentOrders,
    ] = await Promise.all([
      // Total revenue from confirmed invoices this month
      Invoice.aggregate([
        {
          $match: {
            status: "issued",
            createdAt: { $gte: startOfMonth, $lte: endOfMonth },
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),

      // Confirmed orders this month
      Order.countDocuments({
        status: "confirmed",
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      }),

      // Active (all) products count
      Product.countDocuments({}),

      // Low-stock products
      Product.find({}).lean(),

      // 10 most recent orders
      Order.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("createdBy", "name")
        .lean(),
    ]);

    const totalRevenue = monthlyRevenueResult[0]?.total ?? 0;

    // Filter low-stock using virtual logic
    const lowStockList = lowStockProducts.filter(
      (p) => p.quantity <= p.lowStockThreshold
    );

    // ── Daily revenue chart (current month) ───────────────────────────────────

    const dailyRevenue = await Invoice.aggregate([
      {
        $match: {
          status: "issued",
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // ── Top 5 products by quantity sold (all time, confirmed orders) ──────────

    const topProducts = await Order.aggregate([
      { $match: { status: "confirmed" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          productName: { $first: "$items.productName" },
          sku: { $first: "$items.sku" },
          totalQty: { $sum: "$items.quantity" },
          totalRevenue: { $sum: "$items.lineTotal" },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
    ]);

    return NextResponse.json({
      stats: {
        totalRevenue,
        totalOrders: monthlyOrderCount,
        totalProducts: activeProductCount,
        lowStockCount: lowStockList.length,
      },
      dailyRevenue,
      topProducts,
      recentOrders,
      lowStockProducts: lowStockList.slice(0, 10),
    });
  } catch (err) {
    console.error("[GET /api/dashboard]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
