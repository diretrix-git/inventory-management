"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  TrendingUp, TrendingDown, AlertTriangle, Package, BarChart2,
  ShoppingCart, Lightbulb, CheckCircle, Info, Minus,
} from "lucide-react";
import { generateInsights, type Insight } from "@/lib/insights";
import { friendlyError } from "@/lib/errors";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  startDate: string;
  endDate: string;
  monthlyRevenue: { _id: string; revenue: number; orders: number }[];
  topProducts: { _id: string; productName: string; sku: string; totalRevenue: number; totalQty: number }[];
  weeklyTrend: { _id: string; revenue: number; orders: number }[];
  categoryBreakdown: { _id: string; revenue: number; units: number; orders: number; percentage: number }[];
  lowStockProducts: { name: string; quantity: number; lowStockThreshold: number }[];
  summary: { totalRevenue: number; totalOrders: number };
  prevSummary: { totalRevenue: number; totalOrders: number };
}

const PIE_COLORS = ["#185FA5", "#1D9E75", "#BA7517", "#A32D2D", "#71717a", "#3f3f46", "#a1a1aa", "#d4d4d8"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function changePct(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

function ChangeIndicator({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (pct === 0) return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="size-3" />0%</span>;
  const positive = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? "text-success" : "text-destructive"}`}>
      {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {positive ? "+" : ""}{pct}% vs prev period
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ title, value, icon: Icon, change, description, color = "#185FA5" }: {
  title: string;
  value: string;
  icon: React.ElementType;
  change?: number | null;
  description?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className="flex items-center justify-center size-8 rounded-lg" style={{ background: `${color}15` }}>
          <Icon className="size-4" style={{ color }} aria-hidden="true" />
        </div>
      </div>
      <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <div className="flex items-center justify-between gap-2">
        <ChangeIndicator pct={change ?? null} />
        {description && <span className="text-[10px] text-muted-foreground text-right">{description}</span>}
      </div>
    </div>
  );
}

// ─── Insight Card ─────────────────────────────────────────────────────────────

const INSIGHT_STYLES: Record<Insight["severity"], { bg: string; border: string; icon: string }> = {
  danger:  { bg: "bg-destructive/8",  border: "border-destructive/25", icon: "text-destructive"  },
  warning: { bg: "bg-warning/8",      border: "border-warning/25",     icon: "text-warning"      },
  success: { bg: "bg-success/8",      border: "border-success/25",     icon: "text-success"      },
  info:    { bg: "bg-[#185FA5]/8",    border: "border-[#185FA5]/25",   icon: "text-[#185FA5]"   },
};

const INSIGHT_ICONS: Record<Insight["icon"], React.ElementType> = {
  "trending-up":   TrendingUp,
  "trending-down": TrendingDown,
  "alert":         AlertTriangle,
  "package":       Package,
  "check":         CheckCircle,
  "info":          Info,
};

function InsightCard({ insight }: { insight: Insight }) {
  const style = INSIGHT_STYLES[insight.severity];
  const Icon = INSIGHT_ICONS[insight.icon];
  return (
    <div className={`flex gap-3 rounded-xl border p-4 ${style.bg} ${style.border}`}>
      <div className={`mt-0.5 flex-shrink-0 ${style.icon}`}>
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{insight.title}</p>
          {insight.value && (
            <span className={`flex-shrink-0 text-xs font-bold font-mono ${style.icon}`}>{insight.value}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.message}</p>
      </div>
    </div>
  );
}

// ─── Chart Card ───────────────────────────────────────────────────────────────

function ChartCard({ title, children, isEmpty, emptyTitle, emptyDesc }: {
  title: string; children: React.ReactNode;
  isEmpty: boolean; emptyTitle?: string; emptyDesc?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4">{title}</h2>
      {isEmpty ? (
        <EmptyState title={emptyTitle ?? "No data"} description={emptyDesc ?? "No confirmed orders in this range."} className="py-10" />
      ) : children}
    </div>
  );
}

// ─── DateRangePicker ──────────────────────────────────────────────────────────

function DateRangePicker({ startDate, endDate, onStartChange, onEndChange }: {
  startDate: string; endDate: string;
  onStartChange: (v: string) => void; onEndChange: (v: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="text-sm text-muted-foreground">From</label>
      <input type="date" value={startDate} max={today} onChange={(e) => onStartChange(e.target.value)}
        className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <label className="text-sm text-muted-foreground">To</label>
      <input type="date" value={endDate} max={today} onChange={(e) => onEndChange(e.target.value)}
        className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    </div>
  );
}

// ─── AnalyticsPage ────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/analytics?startDate=${startDate}&endDate=${endDate}`);
      const json = await res.json();
      if (!res.ok) { toast.error(friendlyError(json.error)); return; }
      setData(json as AnalyticsData);
    } catch {
      toast.error("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartStyle = {
    contentStyle: {
      background: "var(--color-popover)",
      border: "1px solid var(--color-border)",
      borderRadius: 8,
      fontSize: 12,
    },
    tickStyle: {
      fontSize: 10,
      fontFamily: "var(--font-mono)",
      fill: "var(--color-muted-foreground)",
    },
  };

  // Generate insights from data
  const insights = data ? generateInsights({
    weeklyTrend: data.weeklyTrend,
    monthlyRevenue: data.monthlyRevenue,
    topProducts: data.topProducts,
    categoryBreakdown: data.categoryBreakdown,
    lowStockProducts: data.lowStockProducts,
    summary: data.summary,
    prevSummary: data.prevSummary,
  }) : [];

  const revChange = data ? changePct(data.summary.totalRevenue, data.prevSummary.totalRevenue) : null;
  const ordChange = data ? changePct(data.summary.totalOrders, data.prevSummary.totalOrders) : null;
  const avgOrder = data && data.summary.totalOrders > 0
    ? data.summary.totalRevenue / data.summary.totalOrders
    : 0;
  const prevAvgOrder = data && data.prevSummary.totalOrders > 0
    ? data.prevSummary.totalRevenue / data.prevSummary.totalOrders
    : 0;

  return (
    <PageTransition>
      <PageHeader
        title="Analytics"
        description="Confirmed orders only — all figures exclude pending and cancelled orders."
        action={
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
        }
      />

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Total Revenue"
          value={`Rs ${(data?.summary.totalRevenue ?? 0).toFixed(2)}`}
          icon={TrendingUp}
          change={revChange}
          description="Selected period"
          color="#185FA5"
        />
        <KpiCard
          title="Total Orders"
          value={String(data?.summary.totalOrders ?? 0)}
          icon={ShoppingCart}
          change={ordChange}
          description="Confirmed orders"
          color="#1D9E75"
        />
        <KpiCard
          title="Avg Order Value"
          value={`Rs ${avgOrder.toFixed(2)}`}
          icon={BarChart2}
          change={data ? changePct(avgOrder, prevAvgOrder) : null}
          description="Per confirmed order"
          color="#BA7517"
        />
        <KpiCard
          title="Low Stock Items"
          value={String(data?.lowStockProducts.length ?? 0)}
          icon={AlertTriangle}
          description="Below threshold"
          color="#A32D2D"
        />
      </div>

      {/* ── Insights ───────────────────────────────────────────────────────── */}
      {!isLoading && insights.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="size-4 text-[#BA7517]" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">Insights & Alerts</h2>
            <span className="text-xs text-muted-foreground">({insights.length} insight{insights.length > 1 ? "s" : ""})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* ── Monthly Revenue Chart ───────────────────────────────────────────── */}
      <ChartCard
        title="Monthly Revenue — Last 12 Months"
        isEmpty={!isLoading && (data?.monthlyRevenue.length ?? 0) === 0}
        emptyTitle="No monthly data"
        emptyDesc="No confirmed orders in the last 12 months."
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data?.monthlyRevenue ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="monthlyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#185FA5" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#185FA5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="_id" tick={chartStyle.tickStyle}
              tickFormatter={(v: string) => { const [y, m] = v.split("-"); return `${m}/${y.slice(2)}`; }} />
            <YAxis tick={chartStyle.tickStyle}
              tickFormatter={(v: number) => `Rs ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
            <Tooltip contentStyle={chartStyle.contentStyle}
              formatter={(v: number) => [`Rs ${(v as number).toFixed(2)}`, "Revenue"]}
              labelFormatter={(l: string) => {
                const [y, m] = l.split("-");
                return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="revenue" name="Revenue (Rs)" stroke="#185FA5" strokeWidth={2} fill="url(#monthlyGrad)" />
            <Area type="monotone" dataKey="orders" name="Orders" stroke="#1D9E75" strokeWidth={2} fill="none" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Weekly Sales Trend ──────────────────────────────────────────────── */}
      <div className="mt-4">
        <ChartCard
          title="Weekly Sales Trend — Last 7 Days"
          isEmpty={!isLoading && (data?.weeklyTrend.length ?? 0) === 0}
          emptyTitle="No sales this week"
          emptyDesc="No confirmed orders in the last 7 days."
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data?.weeklyTrend ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="_id" tick={chartStyle.tickStyle}
                tickFormatter={(v: string) => new Date(v).toLocaleDateString("en-US", { weekday: "short", day: "numeric" })} />
              <YAxis yAxisId="rev" tick={chartStyle.tickStyle} tickFormatter={(v: number) => `Rs ${v}`} />
              <YAxis yAxisId="ord" orientation="right" tick={chartStyle.tickStyle} />
              <Tooltip contentStyle={chartStyle.contentStyle}
                labelFormatter={(l: string) => new Date(l).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue (Rs)" stroke="#185FA5" strokeWidth={2.5} dot={{ r: 4, fill: "#185FA5" }} />
              <Line yAxisId="ord" type="monotone" dataKey="orders" name="Orders" stroke="#BA7517" strokeWidth={2} dot={{ r: 3, fill: "#BA7517" }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Top Products + Category ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mt-4">
        {/* Top Selling Products */}
        <ChartCard
          title="Top Selling Products (by Revenue)"
          isEmpty={!isLoading && (data?.topProducts.length ?? 0) === 0}
          emptyTitle="No product sales" emptyDesc="No confirmed orders in this date range."
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data?.topProducts ?? []} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" tick={chartStyle.tickStyle}
                tickFormatter={(v: number) => `Rs ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <YAxis type="category" dataKey="productName" width={90}
                tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
                tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + "…" : v} />
              <Tooltip contentStyle={chartStyle.contentStyle}
                formatter={(v: number, name: string) => [
                  name === "totalRevenue" ? `Rs ${(v as number).toFixed(2)}` : v,
                  name === "totalRevenue" ? "Revenue" : "Units sold",
                ]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="totalRevenue" name="Revenue (Rs)" fill="#185FA5" radius={[0, 4, 4, 0]} />
              <Bar dataKey="totalQty" name="Units sold" fill="#1D9E75" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Category Performance — donut */}
        <ChartCard
          title="Category Performance"
          isEmpty={!isLoading && (data?.categoryBreakdown.length ?? 0) === 0}
          emptyTitle="No category data" emptyDesc="No confirmed orders with categorized products."
        >
          <div className="flex flex-col gap-4">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data?.categoryBreakdown ?? []} dataKey="revenue" nameKey="_id"
                  cx="50%" cy="50%" outerRadius={75} innerRadius={40}>
                  {(data?.categoryBreakdown ?? []).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartStyle.contentStyle}
                  formatter={(v: number) => [`Rs ${(v as number).toFixed(2)}`, "Revenue"]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 text-muted-foreground font-medium">Category</th>
                    <th className="text-right py-1.5 text-muted-foreground font-medium">Revenue</th>
                    <th className="text-right py-1.5 text-muted-foreground font-medium">Units</th>
                    <th className="text-right py-1.5 text-muted-foreground font-medium">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data?.categoryBreakdown ?? []).map((c, i) => (
                    <tr key={c._id}>
                      <td className="py-1.5 flex items-center gap-1.5">
                        <span className="inline-block size-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="font-medium text-foreground">{c._id}</span>
                      </td>
                      <td className="py-1.5 text-right font-mono tabular-nums">Rs {c.revenue.toFixed(2)}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums">{c.units}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums text-muted-foreground">{c.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ── Top Products Detail Table ───────────────────────────────────────── */}
      {(data?.topProducts.length ?? 0) > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Top Products — Detail
            <span className="ml-2 text-xs font-normal text-muted-foreground">(selected date range)</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">#</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Product</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Revenue</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Units Sold</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.topProducts ?? []).map((p, i) => {
                  const pct = data!.summary.totalRevenue > 0
                    ? Math.round((p.totalRevenue / data!.summary.totalRevenue) * 100)
                    : 0;
                  return (
                    <tr key={p._id} className={`hover:bg-muted/40 transition-colors ${i === 0 ? "bg-success/5" : ""}`}>
                      <td className="py-2.5 text-muted-foreground font-mono text-xs w-8">{i + 1}</td>
                      <td className="py-2.5">
                        <p className="font-medium text-foreground">{p.productName}</p>
                        <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                      </td>
                      <td className="py-2.5 text-right font-mono text-sm tabular-nums">Rs {p.totalRevenue.toFixed(2)}</td>
                      <td className="py-2.5 text-right font-mono text-sm tabular-nums">{p.totalQty}</td>
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-[#185FA5]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
