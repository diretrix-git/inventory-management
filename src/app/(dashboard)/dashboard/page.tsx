"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { TrendingUp, ShoppingCart, Package, AlertTriangle } from "lucide-react";

import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  stats: {
    totalRevenue: number;
    totalOrders: number;
    totalProducts: number;
    lowStockCount: number;
  };
  dailyRevenue: { _id: string; revenue: number; orders: number }[];
  topProducts: {
    _id: string;
    productName: string;
    sku: string;
    totalQty: number;
    totalRevenue: number;
  }[];
  recentOrders: {
    _id: string;
    orderNumber: string;
    customerName: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }[];
  lowStockProducts: {
    _id: string;
    name: string;
    sku: string;
    quantity: number;
    lowStockThreshold: number;
  }[];
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { toast.error(json.error); return; }
        setData(json as DashboardData);
      })
      .catch(() => toast.error("Failed to load dashboard data"))
      .finally(() => setIsLoading(false));
  }, []);

  // Stagger variants for list items
  const listVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.04 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
  };

  return (
    <PageTransition>
      <PageHeader title="Dashboard" description="Overview for this month." />

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          title="Monthly Revenue"
          value={isLoading ? 0 : (data?.stats.totalRevenue ?? 0)}
          prefix="$"
          formatValue={(v) => v.toFixed(2)}
          icon={TrendingUp}
          description="Confirmed invoices this month"
        />
        <StatCard
          title="Confirmed Orders"
          value={isLoading ? 0 : (data?.stats.totalOrders ?? 0)}
          icon={ShoppingCart}
          description="This month"
        />
        <StatCard
          title="Total Products"
          value={isLoading ? 0 : (data?.stats.totalProducts ?? 0)}
          icon={Package}
          description="In catalog"
        />
        <StatCard
          title="Low Stock"
          value={isLoading ? 0 : (data?.stats.lowStockCount ?? 0)}
          icon={AlertTriangle}
          description="Products below threshold"
        />
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 mb-6">
        {/* Revenue area chart */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Daily Revenue — This Month
          </h2>
          {!isLoading && (data?.dailyRevenue.length ?? 0) === 0 ? (
            <EmptyState title="No revenue data" description="No confirmed invoices this month yet." className="py-10" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data?.dailyRevenue ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#185FA5" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#185FA5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="_id"
                  tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--color-muted-foreground)" }}
                  tickFormatter={(v: string) => v.slice(5)} // MM-DD
                />
                <YAxis
                  tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--color-muted-foreground)" }}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#185FA5" strokeWidth={2} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top 5 products bar chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Top 5 Products by Qty Sold
          </h2>
          {!isLoading && (data?.topProducts.length ?? 0) === 0 ? (
            <EmptyState title="No sales data" description="No confirmed orders yet." className="py-10" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.topProducts ?? []} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--color-muted-foreground)" }}
                />
                <YAxis
                  type="category"
                  dataKey="productName"
                  width={80}
                  tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
                  tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 10) + "…" : v}
                />
                <Tooltip
                  contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [v, "Units sold"]}
                />
                <Bar dataKey="totalQty" fill="#185FA5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Bottom row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent orders */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Recent Orders</h2>
          {!isLoading && (data?.recentOrders.length ?? 0) === 0 ? (
            <EmptyState title="No orders yet" description="Orders will appear here once created." className="py-8" />
          ) : (
            <motion.ul
              variants={listVariants}
              initial="hidden"
              animate="visible"
              className="divide-y divide-border"
              role="list"
            >
              {(data?.recentOrders ?? []).map((order) => (
                <motion.li key={order._id} variants={itemVariants} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{order.customerName}</p>
                    <p className="font-mono text-xs text-muted-foreground tabular-nums">{order.orderNumber}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={order.status} />
                    <span className="font-mono text-sm tabular-nums">${order.totalAmount.toFixed(2)}</span>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>

        {/* Low stock alerts */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Low Stock Alerts</h2>
          {!isLoading && (data?.lowStockProducts.length ?? 0) === 0 ? (
            <EmptyState
              title="All stocked up"
              description="No products are below their low-stock threshold."
              icon={Package}
              className="py-8"
            />
          ) : (
            <motion.ul
              variants={listVariants}
              initial="hidden"
              animate="visible"
              className="divide-y divide-border"
              role="list"
            >
              {(data?.lowStockProducts ?? []).map((product) => (
                <motion.li key={product._id} variants={itemVariants} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                    <p className="font-mono text-xs text-muted-foreground tabular-nums">{product.sku}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">
                      <AlertTriangle className="size-3" aria-hidden="true" />
                      {product.quantity} left
                    </span>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
