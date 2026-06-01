import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";
import { Invoice } from "@/models/Invoice";
import { Product } from "@/models/Product";
import { auth } from "../../../../auth";

// ─── GET /api/dashboard ───────────────────────────────────────────────────────
// All roles — admin gets today-focused view, staff gets task-focused view

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isStaff = session.user.role === "staff";

  try {
    await connectDB();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // ── Staff dashboard (task-focused) ────────────────────────────────────────
    if (isStaff) {
      const [
        todayRevenueResult,
        pendingOrderCount,
        allProducts,
        recentlySoldProducts,
        recentOrders,
      ] = await Promise.all([
        Invoice.aggregate([
          { $match: { status: "issued", createdAt: { $gte: startOfToday, $lte: endOfToday } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        Order.countDocuments({ status: "pending" }),
        Product.find({}).lean(),
        Order.aggregate([
          { $match: { status: "confirmed", createdAt: { $gte: startOfToday, $lte: endOfToday } } },
          { $unwind: "$items" },
          { $group: { _id: "$items.productId", productName: { $first: "$items.productName" }, sku: { $first: "$items.sku" }, totalQty: { $sum: "$items.quantity" } } },
          { $sort: { totalQty: -1 } },
          { $limit: 8 },
        ]),
        Order.find({}).sort({ createdAt: -1 }).limit(10).lean(),
      ]);

      const lowStockList = allProducts.filter((p) => p.quantity <= p.lowStockThreshold);

      return NextResponse.json({
        role: "staff",
        stats: {
          todayRevenue: todayRevenueResult[0]?.total ?? 0,
          pendingOrders: pendingOrderCount,
          lowStockCount: lowStockList.length,
        },
        lowStockProducts: lowStockList.slice(0, 8),
        recentlySoldProducts,
        recentOrders,
      });
    }

    // ── Admin dashboard ────────────────────────────────────────────────────────

    const [
      todayRevenueResult,
      todayOrderCount,
      pendingApprovalCount,
      allProducts,
      recentOrders,
      topProducts,
    ] = await Promise.all([
      // Today's revenue from confirmed invoices
      Invoice.aggregate([
        { $match: { status: "issued", createdAt: { $gte: startOfToday, $lte: endOfToday } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      // Today's confirmed orders
      Order.countDocuments({ status: "confirmed", createdAt: { $gte: startOfToday, $lte: endOfToday } }),
      // Orders pending admin approval (high-value ≥ ₹15,000)
      Order.countDocuments({ status: "pending", requiresApproval: true }),
      // All products for low-stock check
      Product.find({}).lean(),
      // 10 most recent orders
      Order.find({}).sort({ createdAt: -1 }).limit(10).populate("createdBy", "name").lean(),
      // Top 5 products by qty sold (all time)
      Order.aggregate([
        { $match: { status: "confirmed" } },
        { $unwind: "$items" },
        { $group: { _id: "$items.productId", productName: { $first: "$items.productName" }, sku: { $first: "$items.sku" }, totalQty: { $sum: "$items.quantity" }, totalRevenue: { $sum: "$items.lineTotal" } } },
        { $sort: { totalQty: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const lowStockList = allProducts.filter((p) => p.quantity <= p.lowStockThreshold);

    return NextResponse.json({
      role: "admin",
      stats: {
        todayRevenue: todayRevenueResult[0]?.total ?? 0,
        todayOrders: todayOrderCount,
        pendingApprovals: pendingApprovalCount,
        lowStockCount: lowStockList.length,
      },
      topProducts,
      recentOrders,
      lowStockProducts: lowStockList.slice(0, 10),
    });
  } catch (err) {
    console.error("[GET /api/dashboard]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
