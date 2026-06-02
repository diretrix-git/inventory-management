/**
 * Rule-based insights engine.
 * Generates actionable insights from analytics data without any AI/ML.
 * Each insight has a type, severity, and message.
 */

export type InsightSeverity = "info" | "warning" | "success" | "danger";

export interface Insight {
  id: string;
  type: "revenue" | "stock" | "product" | "category" | "order" | "trend";
  severity: InsightSeverity;
  title: string;
  message: string;
  value?: string;
  icon: "trending-up" | "trending-down" | "alert" | "package" | "check" | "info";
}

interface InsightInput {
  // Weekly trend data (last 7 days)
  weeklyTrend: { _id: string; revenue: number; orders: number }[];
  // Monthly revenue (last 12 months)
  monthlyRevenue: { _id: string; revenue: number; orders: number }[];
  // Top products
  topProducts: { _id: string; productName: string; totalRevenue: number; totalQty: number }[];
  // Category breakdown
  categoryBreakdown: { _id: string; revenue: number; percentage: number }[];
  // Low stock products
  lowStockProducts: { name: string; quantity: number; lowStockThreshold: number }[];
  // Summary
  summary: { totalRevenue: number; totalOrders: number };
  // Previous period summary (for comparison)
  prevSummary?: { totalRevenue: number; totalOrders: number };
}

export function generateInsights(data: InsightInput): Insight[] {
  const insights: Insight[] = [];

  // ── Revenue trend ─────────────────────────────────────────────────────────

  if (data.weeklyTrend.length >= 2) {
    const recent = data.weeklyTrend.slice(-3);
    const earlier = data.weeklyTrend.slice(0, Math.max(1, data.weeklyTrend.length - 3));
    const recentAvg = recent.reduce((s, d) => s + d.revenue, 0) / recent.length;
    const earlierAvg = earlier.reduce((s, d) => s + d.revenue, 0) / earlier.length;

    if (earlierAvg > 0) {
      const changePct = Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100);
      if (changePct >= 15) {
        insights.push({
          id: "revenue-up",
          type: "revenue",
          severity: "success",
          title: "Revenue trending up",
          message: `Revenue increased ${changePct}% in the last 3 days compared to earlier this week.`,
          value: `+${changePct}%`,
          icon: "trending-up",
        });
      } else if (changePct <= -15) {
        insights.push({
          id: "revenue-down",
          type: "revenue",
          severity: "warning",
          title: "Revenue dropped recently",
          message: `Revenue dropped ${Math.abs(changePct)}% in the last 3 days. Consider checking for order issues or low stock.`,
          value: `${changePct}%`,
          icon: "trending-down",
        });
      }
    }

    // Find worst day
    const worstDay = [...data.weeklyTrend].sort((a, b) => a.revenue - b.revenue)[0];
    const bestDay = [...data.weeklyTrend].sort((a, b) => b.revenue - a.revenue)[0];
    if (worstDay && bestDay && worstDay._id !== bestDay._id && bestDay.revenue > 0) {
      const worstPct = Math.round((worstDay.revenue / bestDay.revenue) * 100);
      if (worstPct < 30) {
        const dayName = new Date(worstDay._id).toLocaleDateString("en-US", { weekday: "long" });
        insights.push({
          id: "weak-day",
          type: "trend",
          severity: "info",
          title: `${dayName} is your slowest day`,
          message: `${dayName} generated only ${worstPct}% of your best day's revenue this week. Consider promotions on slow days.`,
          icon: "info",
        });
      }
    }
  }

  // ── Monthly comparison ────────────────────────────────────────────────────

  if (data.monthlyRevenue.length >= 2) {
    const lastMonth = data.monthlyRevenue[data.monthlyRevenue.length - 1];
    const prevMonth = data.monthlyRevenue[data.monthlyRevenue.length - 2];
    if (prevMonth.revenue > 0 && lastMonth) {
      const changePct = Math.round(((lastMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100);
      if (Math.abs(changePct) >= 10) {
        insights.push({
          id: "monthly-compare",
          type: "revenue",
          severity: changePct > 0 ? "success" : "warning",
          title: changePct > 0 ? "Strong month-over-month growth" : "Revenue below last month",
          message: `This month's revenue is ${Math.abs(changePct)}% ${changePct > 0 ? "higher" : "lower"} than last month.`,
          value: `${changePct > 0 ? "+" : ""}${changePct}%`,
          icon: changePct > 0 ? "trending-up" : "trending-down",
        });
      }
    }
  }

  // ── Top product dominance ─────────────────────────────────────────────────

  if (data.topProducts.length > 0 && data.summary.totalRevenue > 0) {
    const top = data.topProducts[0];
    const topPct = Math.round((top.totalRevenue / data.summary.totalRevenue) * 100);
    if (topPct >= 35) {
      insights.push({
        id: "top-product-dominance",
        type: "product",
        severity: topPct >= 60 ? "warning" : "info",
        title: `${top.productName} drives ${topPct}% of revenue`,
        message: topPct >= 60
          ? `Heavy reliance on one product is risky. Consider diversifying your catalog.`
          : `${top.productName} is your top performer. Keep it well-stocked.`,
        value: `${topPct}%`,
        icon: topPct >= 60 ? "alert" : "package",
      });
    }
  }

  // ── Low stock alerts ──────────────────────────────────────────────────────

  const criticalStock = data.lowStockProducts.filter((p) => p.quantity <= 2);
  const lowStock = data.lowStockProducts.filter((p) => p.quantity > 2 && p.quantity <= p.lowStockThreshold);

  if (criticalStock.length > 0) {
    const names = criticalStock.slice(0, 3).map((p) => p.name).join(", ");
    insights.push({
      id: "critical-stock",
      type: "stock",
      severity: "danger",
      title: `${criticalStock.length} product${criticalStock.length > 1 ? "s" : ""} nearly out of stock`,
      message: `${names}${criticalStock.length > 3 ? ` and ${criticalStock.length - 3} more` : ""} ${criticalStock.length === 1 ? "has" : "have"} 2 or fewer units left. Restock immediately.`,
      value: `${criticalStock.length} critical`,
      icon: "alert",
    });
  }

  if (lowStock.length > 0) {
    // Estimate days until stockout based on weekly sales velocity
    const soldThisWeek = data.topProducts.reduce((s, p) => s + p.totalQty, 0);
    const dailyVelocity = soldThisWeek / 7;
    const atRisk = lowStock.filter((p) => dailyVelocity > 0 && (p.quantity / dailyVelocity) <= 5);

    if (atRisk.length > 0) {
      insights.push({
        id: "stockout-risk",
        type: "stock",
        severity: "warning",
        title: `${atRisk.length} product${atRisk.length > 1 ? "s" : ""} may run out within 5 days`,
        message: `Based on current sales velocity, ${atRisk.slice(0, 2).map((p) => p.name).join(", ")}${atRisk.length > 2 ? ` and ${atRisk.length - 2} more` : ""} could run out soon.`,
        value: `${atRisk.length} at risk`,
        icon: "alert",
      });
    }
  }

  // ── Category insights ─────────────────────────────────────────────────────

  if (data.categoryBreakdown.length >= 2) {
    const top = data.categoryBreakdown[0];
    const bottom = data.categoryBreakdown[data.categoryBreakdown.length - 1];
    if (top.percentage >= 50) {
      insights.push({
        id: "category-concentration",
        type: "category",
        severity: "info",
        title: `${top._id} leads with ${top.percentage}% of sales`,
        message: `${top._id} is your dominant category. ${bottom._id} contributes only ${bottom.percentage}% — consider promotions there.`,
        icon: "info",
      });
    }
  }

  // ── Order volume ──────────────────────────────────────────────────────────

  if (data.summary.totalOrders === 0) {
    insights.push({
      id: "no-orders",
      type: "order",
      severity: "warning",
      title: "No confirmed orders in this period",
      message: "There are no confirmed orders in the selected date range. Check if orders are pending approval.",
      icon: "alert",
    });
  } else if (data.summary.totalOrders >= 1 && data.summary.totalRevenue > 0) {
    const avgOrder = data.summary.totalRevenue / data.summary.totalOrders;
    if (avgOrder > 15000) {
      insights.push({
        id: "high-avg-order",
        type: "order",
        severity: "info",
        title: "High average order value",
        message: `Average order value is Rs ${avgOrder.toFixed(0)} — many orders may require admin approval.`,
        value: `Rs ${avgOrder.toFixed(0)} avg`,
        icon: "info",
      });
    }
  }

  // Return top 5 most important insights
  const priority: Record<InsightSeverity, number> = { danger: 0, warning: 1, success: 2, info: 3 };
  return insights.sort((a, b) => priority[a.severity] - priority[b.severity]).slice(0, 6);
}
