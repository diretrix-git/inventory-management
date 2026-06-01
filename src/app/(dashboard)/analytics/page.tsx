"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { TrendingUp, Package, BarChart2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  startDate: string;
  endDate: string;
  monthlyRevenue: { _id: string; revenue: number; orders: number }[];
  topProducts: { _id: string; productName: string; sku: string; totalRevenue: number; totalQty: number }[];
  weeklyTrend: { _id: string; revenue: number; orders: number }[];
  categoryBreakdown: { _id: string; revenue: number; units: number; orders: number; percentage: number }[];
  summary: { totalRevenue: number; totalOrders: number };
}

const PIE_COLORS = ["#185FA5", "#1D9E75", "#BA7517", "#A32D2D", "#71717a", "#3f3f46", "#a1a1aa", "#d4d4d8"];

// ─── DateRangePicker ──────────────────────────────────────────────────────────

function DateRangePicker({
  startDate, endDate,
  onStartChange, onEndChange,
}: {
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

// ─── Chart card wrapper ───────────────────────────────────────────────────────

function ChartCard({ title, children, isEmpty, emptyTitle, emptyDesc }: {
  title: string;
  children: React.ReactNode;
  isEmpty: boolean;
  emptyTitle?: string;
  emptyDesc?: string;
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
      toast.error("Connection error. Please check your internet and try again.");
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

  return (
    <PageTransition>
      <PageHeader
        title="Analytics"
        description="Confirmed orders only. All figures exclude pending and cancelled orders."
        action={
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-1">
            <TrendingUp className="size-4 text-[#185FA5]" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">Total Revenue (selected range)</p>
          </div>
          <p className="font-mono text-2xl font-semibold tabular-nums">
            Rs {(data?.summary.totalRevenue ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-1">
            <BarChart2 className="size-4 text-[#1D9E75]" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">Total Orders (selected range)</p>
          </div>
          <p className="font-mono text-2xl font-semibold tabular-nums">
            {data?.summary.totalOrders ?? 0}
          </p>
        </div>
      </div>

      {/* ── 1. Monthly Revenue Chart ─────────────────────────────────────────── */}
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
            <XAxis
              dataKey="_id"
              tick={chartStyle.tickStyle}
              tickFormatter={(v: string) => {
                const [y, m] = v.split("-");
                return `${m}/${y.slice(2)}`;
              }}
            />
            <YAxis tick={chartStyle.tickStyle} tickFormatter={(v: number) => `Rs ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
            <Tooltip
              contentStyle={chartStyle.contentStyle}
              formatter={(v: number) => [`Rs Rs {v.toFixed(2)}`, "Revenue"]}
              labelFormatter={(l: string) => {
                const [y, m] = l.split("-");
                return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="revenue" name="Revenue ($)" stroke="#185FA5" strokeWidth={2} fill="url(#monthlyGrad)" />
            <Area type="monotone" dataKey="orders" name="Orders" stroke="#1D9E75" strokeWidth={2} fill="none" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── 2. Weekly Sales Trend ────────────────────────────────────────────── */}
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
              <XAxis
                dataKey="_id"
                tick={chartStyle.tickStyle}
                tickFormatter={(v: string) => new Date(v).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              />
              <YAxis yAxisId="rev" tick={chartStyle.tickStyle} tickFormatter={(v: number) => `Rs ${v}`} />
              <YAxis yAxisId="ord" orientation="right" tick={chartStyle.tickStyle} />
              <Tooltip
                contentStyle={chartStyle.contentStyle}
                labelFormatter={(l: string) => new Date(l).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue ($)" stroke="#185FA5" strokeWidth={2} dot={{ r: 4 }} />
              <Line yAxisId="ord" type="monotone" dataKey="orders" name="Orders" stroke="#BA7517" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── 3 & 4. Top Products + Category Performance ───────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mt-4">
        {/* Top Selling Products */}
        <ChartCard
          title="Top Selling Products (by Revenue)"
          isEmpty={!isLoading && (data?.topProducts.length ?? 0) === 0}
          emptyTitle="No product sales"
          emptyDesc="No confirmed orders in this date range."
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data?.topProducts ?? []} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" tick={chartStyle.tickStyle} tickFormatter={(v: number) => `Rs ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <YAxis
                type="category"
                dataKey="productName"
                width={90}
                tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
                tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + "…" : v}
              />
              <Tooltip
                contentStyle={chartStyle.contentStyle}
                formatter={(v: number, name: string) => [
                  name === "totalRevenue" ? `Rs Rs {v.toFixed(2)}` : v,
                  name === "totalRevenue" ? "Revenue" : "Units sold",
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="totalRevenue" name="Revenue ($)" fill="#185FA5" radius={[0, 4, 4, 0]} />
              <Bar dataKey="totalQty" name="Units sold" fill="#1D9E75" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Category Performance */}
        <ChartCard
          title="Category Performance"
          isEmpty={!isLoading && (data?.categoryBreakdown.length ?? 0) === 0}
          emptyTitle="No category data"
          emptyDesc="No confirmed orders with categorized products."
        >
          <div className="flex flex-col gap-4">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={data?.categoryBreakdown ?? []}
                  dataKey="revenue"
                  nameKey="_id"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={35}
                >
                  {(data?.categoryBreakdown ?? []).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={chartStyle.contentStyle}
                  formatter={(v: number) => [`Rs Rs {v.toFixed(2)}`, "Revenue"]}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Category table */}
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

      {/* Top products detail table */}
      {(data?.topProducts.length ?? 0) > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Top Products — Detail Table
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
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.topProducts ?? []).map((p, i) => (
                  <tr key={p._id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2 text-muted-foreground font-mono text-xs">{i + 1}</td>
                    <td className="py-2">
                      <p className="font-medium text-foreground">{p.productName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                    </td>
                    <td className="py-2 text-right font-mono text-sm tabular-nums">Rs {p.totalRevenue.toFixed(2)}</td>
                    <td className="py-2 text-right font-mono text-sm tabular-nums">{p.totalQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
