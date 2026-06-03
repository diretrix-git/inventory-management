"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  TrendingUp, TrendingDown, AlertTriangle, Package,
  ShoppingCart, Users, BarChart2, CheckCircle, XCircle, Clock,
  Minus, Lightbulb,
} from "lucide-react";
import { generateInsights } from "@/lib/insights";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  startDate: string;
  endDate: string;
  monthlyRevenue: { _id: string; revenue: number; orders: number }[];
  dailyRevenue: { _id: string; revenue: number; orders: number }[];
  topProducts: { _id: string; productName: string; sku?: string; totalRevenue: number; totalQty: number; orderCount: number }[];
  dyingProducts: { name: string; sku?: string; quantity: number; price: number }[];
  inventoryHealth: { total: number; healthy: number; lowStock: number; outOfStock: number; totalValue: number };
  categoryBreakdown: { _id: string; revenue: number; units: number; percentage: number }[];
  orderFlow: { pending: number; confirmed: number; cancelled: number; pendingApprovals: number; cancellationRate: number };
  staffPerformance: { _id: string; userName: string; totalOrders: number; confirmedOrders: number; totalRevenue: number }[];
  summary: { totalRevenue: number; totalOrders: number; avgOrderValue: number };
  prevSummary: { totalRevenue: number; totalOrders: number };
}

const PIE_COLORS = ["#185FA5", "#1D9E75", "#BA7517", "#A32D2D", "#71717a", "#3f3f46"];

// ─── Preset date ranges ────────────────────────────────────────────────────────

const PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "This year", days: -1 }, // special
] as const;

function getPresetDates(days: number): { start: string; end: string } {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  if (days === -1) {
    // This year
    const start = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
    return { start, end };
  }
  const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return { start, end };
}

// ─── Small reusable components ────────────────────────────────────────────────

function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex items-center justify-center size-7 rounded-lg bg-muted">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-foreground">{children}</h2>
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      {children}
    </div>
  );
}

function KpiCard({ label, value, change, icon: Icon, color = "#185FA5" }: {
  label: string; value: string; change?: number | null; icon: React.ElementType; color?: string;
}) {
  const hasChange = change !== null && change !== undefined;
  const positive = (change ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <div className="size-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon className="size-3.5" style={{ color }} aria-hidden="true" />
        </div>
      </div>
      <p className="font-mono text-xl font-semibold tabular-nums">{value}</p>
      {hasChange && (
        <span className={cn("inline-flex items-center gap-1 text-xs font-medium", positive ? "text-success" : "text-destructive")}>
          {change === 0 ? <Minus className="size-3" /> : positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {change === 0 ? "No change" : `${positive ? "+" : ""}${change}% vs prior period`}
        </span>
      )}
    </div>
  );
}

function NoData({ message = "No data for this period" }: { message?: string }) {
  return <EmptyState title="No data" description={message} className="py-8" />;
}

const chartStyle = {
  content: { background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 },
  tick: { fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--color-muted-foreground)" },
};

function pctChange(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

// ─── Analytics Page ────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(() => getPresetDates(30).start);
  const [endDate, setEndDate] = useState(today);
  const [activePreset, setActivePreset] = useState<number>(30);
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

  function applyPreset(days: number) {
    const { start, end } = getPresetDates(days);
    setStartDate(start);
    setEndDate(end);
    setActivePreset(days);
  }

  // Insights from data
  const insights = data ? generateInsights({
    weeklyTrend: data.dailyRevenue.slice(-7),
    monthlyRevenue: data.monthlyRevenue,
    topProducts: data.topProducts,
    categoryBreakdown: data.categoryBreakdown,
    lowStockProducts: [
      ...Array(data.inventoryHealth.outOfStock).fill({ name: "Out of stock", quantity: 0, lowStockThreshold: 1 }),
      ...Array(data.inventoryHealth.lowStock).fill({ name: "Low stock", quantity: 1, lowStockThreshold: 5 }),
    ],
    summary: data.summary,
    prevSummary: data.prevSummary,
  }) : [];

  const revChange = data ? pctChange(data.summary.totalRevenue, data.prevSummary.totalRevenue) : null;
  const ordChange = data ? pctChange(data.summary.totalOrders, data.prevSummary.totalOrders) : null;

  return (
    <PageTransition>
      {/* Header + date controls */}
      <PageHeader title="Analytics" description="Confirmed orders only." />

      {/* Date range controls */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {/* Presets */}
        <div className="flex gap-1.5 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => applyPreset(p.days)}
              className={cn(
                "h-8 px-3 rounded-lg border text-sm font-medium transition-colors",
                activePreset === p.days && startDate === getPresetDates(p.days).start
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:text-foreground hover:border-ring"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <span className="text-muted-foreground text-sm hidden sm:inline">or</span>

        {/* Custom range */}
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} max={today}
            onChange={(e) => { setStartDate(e.target.value); setActivePreset(-99); }}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <span className="text-muted-foreground text-sm">–</span>
          <input type="date" value={endDate} max={today}
            onChange={(e) => { setEndDate(e.target.value); setActivePreset(-99); }}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
      </div>

      {/* ── KPI Summary ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Revenue" value={`Rs ${(data?.summary.totalRevenue ?? 0).toFixed(0)}`} change={revChange} icon={TrendingUp} color="#185FA5" />
        <KpiCard label="Orders" value={String(data?.summary.totalOrders ?? 0)} change={ordChange} icon={ShoppingCart} color="#1D9E75" />
        <KpiCard label="Avg Order Value" value={`Rs ${(data?.summary.avgOrderValue ?? 0).toFixed(0)}`} icon={BarChart2} color="#BA7517" />
        <KpiCard label="Needs Approval" value={String(data?.orderFlow.pendingApprovals ?? 0)} icon={Clock} color="#A32D2D" />
      </div>

      {/* ── Insights ────────────────────────────────────────────────────────── */}
      {!isLoading && insights.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="size-4 text-warning" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">Key Insights</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {insights.map((ins) => {
              const colorMap = { danger: "border-destructive/30 bg-destructive/6", warning: "border-warning/30 bg-warning/6", success: "border-success/30 bg-success/6", info: "border-[#185FA5]/30 bg-[#185FA5]/6" };
              const iconColorMap = { danger: "text-destructive", warning: "text-warning", success: "text-success", info: "text-[#185FA5]" };
              return (
                <div key={ins.id} className={cn("flex gap-3 rounded-xl border p-3.5", colorMap[ins.severity])}>
                  <AlertTriangle className={cn("size-4 mt-0.5 flex-shrink-0", iconColorMap[ins.severity])} aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{ins.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ins.message}</p>
                  </div>
                  {ins.value && <span className={cn("text-xs font-bold font-mono flex-shrink-0", iconColorMap[ins.severity])}>{ins.value}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          Q1: Are sales growing?
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className="mb-4">
        <SectionTitle icon={TrendingUp}>Are sales growing?</SectionTitle>
        {!isLoading && (data?.dailyRevenue.length ?? 0) === 0 ? (
          <NoData message="No confirmed orders in this period." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data?.dailyRevenue ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#185FA5" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#185FA5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="_id" tick={chartStyle.tick}
                tickFormatter={(v: string) => new Date(v + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
              <YAxis tick={chartStyle.tick} tickFormatter={(v: number) => `Rs ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip contentStyle={chartStyle.content}
                formatter={(v: number) => [`Rs ${(v as number).toFixed(2)}`, "Revenue"]}
                labelFormatter={(l: string) => new Date(l + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} />
              <Area type="monotone" dataKey="revenue" stroke="#185FA5" strokeWidth={2} fill="url(#revenueGrad)" name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        )}
        {/* Monthly trend below */}
        {(data?.monthlyRevenue.length ?? 0) > 1 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3">Month-over-month (last 12 months)</p>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={data?.monthlyRevenue ?? []} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="_id" tick={chartStyle.tick}
                  tickFormatter={(v: string) => { const [, m] = v.split("-"); return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m) - 1]; }} />
                <Tooltip contentStyle={chartStyle.content} formatter={(v: number) => [`Rs ${(v as number).toFixed(0)}`, "Revenue"]} />
                <Bar dataKey="revenue" fill="#185FA5" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          Q2: Which products sell best / are dying?
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Best sellers */}
        <Card>
          <SectionTitle icon={Package}>Top selling products</SectionTitle>
          {!isLoading && (data?.topProducts.length ?? 0) === 0 ? (
            <NoData message="No products sold in this period." />
          ) : (
            <div className="space-y-2">
              {(data?.topProducts ?? []).slice(0, 8).map((p, i) => {
                const maxRevenue = data!.topProducts[0]?.totalRevenue ?? 1;
                const pct = Math.round((p.totalRevenue / maxRevenue) * 100);
                return (
                  <div key={p._id} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-mono w-4 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-sm font-medium text-foreground truncate">{p.productName}</p>
                        <span className="text-xs font-mono text-muted-foreground flex-shrink-0 ml-2">Rs {p.totalRevenue.toFixed(0)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-[#185FA5] transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono flex-shrink-0">{p.totalQty} sold</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Dying products */}
        <Card>
          <SectionTitle icon={AlertTriangle}>Products with no sales</SectionTitle>
          {!isLoading && (data?.dyingProducts.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="size-8 text-success mb-2" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">All products are selling</p>
              <p className="text-xs text-muted-foreground">Every product in your catalog sold at least once.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                These products are in stock but had zero confirmed orders in the selected period.
              </p>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {(data?.dyingProducts ?? []).map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      {p.sku && <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>}
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-xs text-muted-foreground">{p.quantity} in stock</p>
                      <p className="font-mono text-xs">Rs {p.price.toFixed(0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Q3: Is inventory healthy?
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className="mb-4">
        <SectionTitle icon={Package}>Is inventory healthy?</SectionTitle>
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Products", value: data.inventoryHealth.total, color: "#185FA5", icon: Package },
              { label: "Healthy Stock", value: data.inventoryHealth.healthy, color: "#1D9E75", icon: CheckCircle },
              { label: "Low Stock", value: data.inventoryHealth.lowStock, color: "#BA7517", icon: AlertTriangle },
              { label: "Out of Stock", value: data.inventoryHealth.outOfStock, color: "#A32D2D", icon: XCircle },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-1 rounded-lg border border-border p-3" style={{ borderLeftColor: s.color, borderLeftWidth: 3 }}>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-semibold font-mono tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Total inventory value</p>
          <p className="font-mono text-lg font-semibold">Rs {(data?.inventoryHealth.totalValue ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
        </div>
        {/* Category revenue breakdown */}
        {(data?.categoryBreakdown.length ?? 0) > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3">Revenue by category</p>
            <div className="flex gap-4">
              <ResponsiveContainer width="40%" height={120}>
                <PieChart>
                  <Pie data={data?.categoryBreakdown ?? []} dataKey="revenue" cx="50%" cy="50%" outerRadius={55} innerRadius={28}>
                    {(data?.categoryBreakdown ?? []).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartStyle.content} formatter={(v: number) => [`Rs ${(v as number).toFixed(0)}`, "Revenue"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {(data?.categoryBreakdown ?? []).slice(0, 5).map((c, i) => (
                  <div key={c._id} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-foreground flex-1 truncate">{c._id}</span>
                    <span className="text-xs font-mono text-muted-foreground">{c.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          Q4: Are orders flowing smoothly?
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className="mb-4">
        <SectionTitle icon={ShoppingCart}>Are orders flowing smoothly?</SectionTitle>
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Confirmed", value: data.orderFlow.confirmed, color: "#1D9E75", icon: CheckCircle },
              { label: "Pending", value: data.orderFlow.pending, color: "#BA7517", icon: Clock },
              { label: "Cancelled", value: data.orderFlow.cancelled, color: "#A32D2D", icon: XCircle },
              { label: "Awaiting Approval", value: data.orderFlow.pendingApprovals, color: "#185FA5", icon: AlertTriangle },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-1 rounded-lg border border-border p-3" style={{ borderLeftColor: s.color, borderLeftWidth: 3 }}>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-semibold font-mono tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
        )}
        {(data?.orderFlow.cancellationRate ?? 0) > 20 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/8 px-3 py-2">
            <AlertTriangle className="size-4 text-warning flex-shrink-0" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              Cancellation rate is <strong className="text-warning">{data?.orderFlow.cancellationRate}%</strong> — higher than normal. Consider reviewing why orders are being cancelled.
            </p>
          </div>
        )}
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          Q5: Are staff performing properly?
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className="mb-4">
        <SectionTitle icon={Users}>Are staff performing properly?</SectionTitle>
        {!isLoading && (data?.staffPerformance.length ?? 0) === 0 ? (
          <NoData message="No orders placed in this period." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left py-2 font-medium">Staff Member</th>
                  <th className="text-right py-2 font-medium">Orders Placed</th>
                  <th className="text-right py-2 font-medium">Confirmed</th>
                  <th className="text-right py-2 font-medium">Conversion</th>
                  <th className="text-right py-2 font-medium">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.staffPerformance ?? []).map((s) => {
                  const convRate = s.totalOrders > 0 ? Math.round((s.confirmedOrders / s.totalOrders) * 100) : 0;
                  const isGood = convRate >= 70;
                  return (
                    <tr key={s._id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 font-medium text-foreground">{s.userName}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums">{s.totalOrders}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums">{s.confirmedOrders}</td>
                      <td className="py-2.5 text-right">
                        <span className={cn("font-mono text-xs font-semibold", isGood ? "text-success" : "text-warning")}>
                          {convRate}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums">Rs {s.totalRevenue.toFixed(0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">Conversion = confirmed orders ÷ total orders placed. Below 70% may indicate frequent cancellations.</p>
      </Card>
    </PageTransition>
  );
}
