"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  startDate: string;
  endDate: string;
  dailyData: { _id: string; revenue: number; orders: number }[];
  categoryBreakdown: { _id: string; revenue: number; units: number; percentage: number }[];
  topProducts: { _id: string; productName: string; sku: string; totalRevenue: number; totalQty: number }[];
  summary: { totalRevenue: number; totalOrders: number };
}

const PIE_COLORS = ["#185FA5", "#1D9E75", "#BA7517", "#A32D2D", "#71717a", "#3f3f46", "#a1a1aa"];

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
      if (!res.ok) { toast.error(json.error ?? "Failed to load analytics"); return; }
      setData(json as AnalyticsData);
    } catch {
      toast.error("Network error");
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <PageTransition>
      <PageHeader
        title="Analytics"
        description="Revenue and order insights from confirmed orders only."
        action={<DateRangePicker startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
          <p className="font-mono text-2xl font-semibold tabular-nums">${(data?.summary.totalRevenue ?? 0).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground mb-1">Total Orders</p>
          <p className="font-mono text-2xl font-semibold tabular-nums">{data?.summary.totalOrders ?? 0}</p>
        </div>
      </div>

      {/* Daily revenue + orders chart */}
      <div className="rounded-xl border border-border bg-card p-5 mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Daily Revenue &amp; Orders</h2>
        {!isLoading && (data?.dailyData.length ?? 0) === 0 ? (
          <EmptyState title="No data" description="No confirmed orders in this date range." className="py-10" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data?.dailyData ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#185FA5" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#185FA5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="_id" tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--color-muted-foreground)" }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis yAxisId="rev" tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--color-muted-foreground)" }} tickFormatter={(v: number) => `$${v}`} />
              <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--color-muted-foreground)" }} />
              <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue ($)" stroke="#185FA5" strokeWidth={2} fill="url(#revGrad)" />
              <Area yAxisId="ord" type="monotone" dataKey="orders" name="Orders" stroke="#1D9E75" strokeWidth={2} fill="none" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Category + Top products row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Category pie */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Revenue by Category</h2>
          {!isLoading && (data?.categoryBreakdown.length ?? 0) === 0 ? (
            <EmptyState title="No data" description="No category data available." className="py-8" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data?.categoryBreakdown ?? []} dataKey="revenue" nameKey="_id" cx="50%" cy="50%" outerRadius={80} label={({ _id, percentage }: { _id: string; percentage: number }) => `${_id} ${percentage}%`} labelLine={false}>
                  {(data?.categoryBreakdown ?? []).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top 10 products */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Top 10 Products by Revenue</h2>
          {!isLoading && (data?.topProducts.length ?? 0) === 0 ? (
            <EmptyState title="No data" description="No product sales in this range." className="py-8" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Product</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Revenue</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Units</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data?.topProducts ?? []).map((p) => (
                    <tr key={p._id}>
                      <td className="py-2">
                        <p className="font-medium text-foreground truncate max-w-[160px]">{p.productName}</p>
                        <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                      </td>
                      <td className="py-2 text-right font-mono text-sm tabular-nums">${p.totalRevenue.toFixed(2)}</td>
                      <td className="py-2 text-right font-mono text-sm tabular-nums">{p.totalQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
