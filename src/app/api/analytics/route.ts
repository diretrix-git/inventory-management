import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";
import { Product } from "@/models/Product";
import { User } from "@/models/User";
import { requireRole } from "@/lib/auth-utils";

// ─── GET /api/analytics ───────────────────────────────────────────────────────
// Admin only — comprehensive analytics answering 6 key business questions

export async function GET(req: NextRequest) {
  const authResult = await requireRole(req, ["admin"]);
  if (authResult.response) return authResult.response;

  const { searchParams } = req.nextUrl;
  const now = new Date();

  // ── Date range handling ────────────────────────────────────────────────────
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);
  defaultStart.setHours(0, 0, 0, 0);

  let startDate = new Date(searchParams.get("startDate") ?? defaultStart.toISOString());
  let endDate = new Date(searchParams.get("endDate") ?? now.toISOString());

  if (endDate > now) endDate = now;
  if (startDate > now) startDate = defaultStart;
  endDate.setHours(23, 59, 59, 999);

  // Fixed windows for specific views
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  // Previous period (same duration)
  const rangeDuration = endDate.getTime() - startDate.getTime();
  const prevEnd = new Date(startDate.getTime() - 1);
  const prevStart = new Date(startDate.getTime() - rangeDuration);

  try {
    await connectDB();

    const matchConfirmed = {
      status: "confirmed" as const,
      createdAt: { $gte: startDate, $lte: endDate },
    };

    const [
      // Q1: Are sales growing? — monthly trend
      monthlyRevenue,
      // Q2: Which products sell best?
      topProducts,
      // Q2b: Which products are dying? — products with zero sales in range
      allProductIds,
      // Q3: Inventory health
      allProducts,
      // Q4: Order flow — status breakdown + daily trend
      orderStatusBreakdown,
      dailyRevenue,
      // Q5: Staff performance — orders created per user
      ordersByStaff,
      // Q6: Category breakdown
      categoryData,
      // Summaries
      rangeSummary,
      prevSummary,
      pendingApprovalCount,
    ] = await Promise.all([
      // ── Q1: Monthly revenue trend (12 months) ──────────────────────────────
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

      // ── Q2: Top selling products ───────────────────────────────────────────
      Order.aggregate([
        { $match: matchConfirmed },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            productName: { $first: "$items.productName" },
            sku: { $first: "$items.sku" },
            totalRevenue: { $sum: "$items.lineTotal" },
            totalQty: { $sum: "$items.quantity" },
            orderCount: { $addToSet: "$_id" },
          },
        },
        { $addFields: { orderCount: { $size: "$orderCount" } } },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
      ]),

      // ── Q2b: All product IDs that sold in the range (for dying calc) ──────
      Order.aggregate([
        { $match: matchConfirmed },
        { $unwind: "$items" },
        { $group: { _id: "$items.productId" } },
      ]),

      // ── Q3: All products for inventory health ─────────────────────────────
      Product.find({}).select("name sku quantity lowStockThreshold price category").lean(),

      // ── Q4: Order status breakdown ─────────────────────────────────────────
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      // ── Q4b: Daily revenue in range ────────────────────────────────────────
      Order.aggregate([
        { $match: matchConfirmed },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // ── Q5: Orders by staff member ─────────────────────────────────────────
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: "$createdBy",
            totalOrders: { $sum: 1 },
            confirmedOrders: {
              $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
            },
            totalRevenue: {
              $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, "$totalAmount", 0] },
            },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            totalOrders: 1,
            confirmedOrders: 1,
            totalRevenue: 1,
            userName: { $ifNull: ["$user.name", "Unknown"] },
          },
        },
        { $sort: { totalOrders: -1 } },
      ]),

      // ── Q6: Category performance ───────────────────────────────────────────
      Order.aggregate([
        { $match: matchConfirmed },
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

      // ── Summaries ──────────────────────────────────────────────────────────
      Order.aggregate([
        { $match: matchConfirmed },
        { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" }, totalOrders: { $sum: 1 } } },
      ]),

      Order.aggregate([
        { $match: { status: "confirmed" as const, createdAt: { $gte: prevStart, $lte: prevEnd } } },
        { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" }, totalOrders: { $sum: 1 } } },
      ]),

      Order.countDocuments({ status: "pending", requiresApproval: true }),
    ]);

    // ── Dying products: in catalog but no sales in this range ────────────────
    const soldProductIds = new Set(allProductIds.map((p: { _id: unknown }) => String(p._id)));
    const dyingProducts = (allProducts as { _id: unknown; name: string; sku?: string; quantity: number; price: number }[])
      .filter((p) => !soldProductIds.has(String(p._id)) && p.quantity > 0)
      .slice(0, 10)
      .map((p) => ({ name: p.name, sku: p.sku, quantity: p.quantity, price: p.price }));

    // ── Inventory health ──────────────────────────────────────────────────────
    const inventoryHealth = {
      total: allProducts.length,
      healthy: 0,
      lowStock: 0,
      outOfStock: 0,
      totalValue: 0,
    };
    for (const p of allProducts as { quantity: number; lowStockThreshold: number; price: number }[]) {
      inventoryHealth.totalValue += p.price * p.quantity;
      if (p.quantity === 0) inventoryHealth.outOfStock++;
      else if (p.quantity <= p.lowStockThreshold) inventoryHealth.lowStock++;
      else inventoryHealth.healthy++;
    }

    // ── Category percentages ──────────────────────────────────────────────────
    const totalCatRevenue = categoryData.reduce((s: number, c: { revenue: number }) => s + c.revenue, 0);
    const categoryBreakdown = categoryData.map((c: { _id: string; revenue: number; units: number }) => ({
      ...c,
      percentage: totalCatRevenue > 0 ? Math.round((c.revenue / totalCatRevenue) * 1000) / 10 : 0,
    }));

    // ── Order flow ────────────────────────────────────────────────────────────
    const statusMap: Record<string, number> = {};
    for (const s of orderStatusBreakdown as { _id: string; count: number }[]) {
      statusMap[s._id] = s.count;
    }
    const orderFlow = {
      pending: statusMap["pending"] ?? 0,
      confirmed: statusMap["confirmed"] ?? 0,
      cancelled: statusMap["cancelled"] ?? 0,
      pendingApprovals: pendingApprovalCount,
      cancellationRate: (() => {
        const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
        return total > 0 ? Math.round(((statusMap["cancelled"] ?? 0) / total) * 100) : 0;
      })(),
    };

    return NextResponse.json({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      // Q1: Sales growth
      monthlyRevenue,
      dailyRevenue,
      summary: {
        totalRevenue: rangeSummary[0]?.totalRevenue ?? 0,
        totalOrders: rangeSummary[0]?.totalOrders ?? 0,
        avgOrderValue: rangeSummary[0]?.totalOrders > 0
          ? (rangeSummary[0].totalRevenue / rangeSummary[0].totalOrders)
          : 0,
      },
      prevSummary: {
        totalRevenue: prevSummary[0]?.totalRevenue ?? 0,
        totalOrders: prevSummary[0]?.totalOrders ?? 0,
      },
      // Q2: Products
      topProducts,
      dyingProducts,
      // Q3: Inventory
      inventoryHealth,
      categoryBreakdown,
      // Q4: Order flow
      orderFlow,
      // Q5: Staff performance
      staffPerformance: ordersByStaff,
    });
  } catch (err) {
    console.error("[GET /api/analytics]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
