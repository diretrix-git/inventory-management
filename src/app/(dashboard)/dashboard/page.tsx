"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import {
  TrendingUp, ShoppingCart, Package, AlertTriangle,
  Clock, CheckCircle, Plus, Eye,
} from "lucide-react";
import Link from "next/link";

import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { useRole } from "@/components/providers/RoleProvider";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminDashboardData {
  role: "admin";
  stats: { totalRevenue: number; totalOrders: number; totalProducts: number; lowStockCount: number };
  dailyRevenue: { _id: string; revenue: number; orders: number }[];
  topProducts: { _id: string; productName: string; sku: string; totalQty: number }[];
  recentOrders: { _id: string; orderNumber: string; customerName: string; status: string; totalAmount: number; createdAt: string }[];
  lowStockProducts: { _id: string; name: string; sku: string; quantity: number; lowStockThreshold: number }[];
}

interface StaffDashboardData {
  role: "staff";
  stats: { todayRevenue: number; pendingOrders: number; lowStockCount: number };
  lowStockProducts: { _id: string; name: string; sku: string; quantity: number; lowStockThreshold: number }[];
  recentlySoldProducts: { _id: string; productName: string; sku: string; totalQty: number }[];
  recentOrders: { _id: string; orderNumber: string; customerName: string; status: string; totalAmount: number; createdAt: string }[];
}

type DashboardData = AdminDashboardData | StaffDashboardData;

// ─── Stagger animation helpers ────────────────────────────────────────────────

const listVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

// ─── Staff Dashboard ──────────────────────────────────────────────────────────

function StaffDashboard({ data, isLoading }: { data: StaffDashboardData | null; isLoading: boolean }) {
  return (
    <>
      <PageHeader title="My Dashboard" description={`Today — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`} />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <StatCard title="Today's Sales" value={isLoading ? 0 : (data?.stats.todayRevenue ?? 0)} prefix="$" formatValue={(v) => v.toFixed(2)} icon={TrendingUp} description="Confirmed today" />
        <StatCard title="Pending Orders" value={isLoading ? 0 : (data?.stats.pendingOrders ?? 0)} icon={Clock} description="Awaiting confirmation" />
        <StatCard title="Low Stock Items" value={isLoading ? 0 : (data?.stats.lowStockCount ?? 0)} icon={AlertTriangle} description="Need restocking" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mb-6">
        {/* Recently sold products */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Recently Sold Today</h2>
            <Link href="/products" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {!isLoading && (data?.recentlySoldProducts.length ?? 0) === 0 ? (
            <EmptyState title="No sales today" description="Products sold today will appear here." icon={Package} className="py-8" />
          ) : (
            <motion.ul variants={listVariants} initial="hidden" animate="visible" className="divide-y divide-border" role="list">
              {(data?.recentlySoldProducts ?? []).map((p) => (
                <motion.li key={p._id} variants={itemVariants} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.productName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-muted-foreground flex-shrink-0">×{p.totalQty} sold</span>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>

        {/* Low stock alerts */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Low Stock Alerts</h2>
            <Link href="/products" className="text-xs text-primary hover:underline">View products</Link>
          </div>
          {!isLoading && (data?.lowStockProducts.length ?? 0) === 0 ? (
            <EmptyState title="All stocked up" description="No products are below their threshold." icon={Package} className="py-8" />
          ) : (
            <motion.ul variants={listVariants} initial="hidden" animate="visible" className="divide-y divide-border" role="list">
              {(data?.lowStockProducts ?? []).map((p) => (
                <motion.li key={p._id} variants={itemVariants} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning flex-shrink-0">
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    {p.quantity} left
                  </span>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>
      </div>

      {/* Pending orders */}
      <div className="rounded-xl border border-border bg-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Recent Orders</h2>
          <Link href="/orders" className="text-xs text-primary hover:underline">View all orders</Link>
        </div>
        {!isLoading && (data?.recentOrders.length ?? 0) === 0 ? (
          <EmptyState title="No orders yet" description="Orders will appear here once created." className="py-8" />
        ) : (
          <motion.ul variants={listVariants} initial="hidden" animate="visible" className="divide-y divide-border" role="list">
            {(data?.recentOrders ?? []).map((o) => (
              <motion.li key={o._id} variants={itemVariants} className="flex items-center justify-between py-2.5 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{o.customerName}</p>
                  <p className="font-mono text-xs text-muted-foreground">{o.orderNumber}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusBadge status={o.status} />
                  <span className="font-mono text-sm tabular-nums">${o.totalAmount.toFixed(2)}</span>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "New Order", href: "/orders", icon: Plus, description: "Create a customer order" },
            { label: "View Products", href: "/products", icon: Package, description: "Browse product catalog" },
            { label: "View Invoices", href: "/invoices", icon: Eye, description: "Check invoice status" },
            { label: "View Orders", href: "/orders", icon: ShoppingCart, description: "Manage all orders" },
            { label: "My Profile", href: "/profile", icon: CheckCircle, description: "Update your details" },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/40 p-4 text-center hover:bg-muted transition-colors group"
            >
              <div className="flex items-center justify-center size-10 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <action.icon className="size-5 text-primary" aria-hidden="true" />
              </div>
              <span className="text-sm font-medium text-foreground">{action.label}</span>
              <span className="text-xs text-muted-foreground">{action.description}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

function AdminDashboard({ data, isLoading }: { data: AdminDashboardData | null; isLoading: boolean }) {
  const listVariants2 = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };

  return (
    <>
      <PageHeader title="Dashboard" description="Overview for this month." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard title="Monthly Revenue" value={isLoading ? 0 : (data?.stats.totalRevenue ?? 0)} prefix="$" formatValue={(v) => v.toFixed(2)} icon={TrendingUp} description="Confirmed invoices this month" />
        <StatCard title="Confirmed Orders" value={isLoading ? 0 : (data?.stats.totalOrders ?? 0)} icon={ShoppingCart} description="This month" />
        <StatCard title="Total Products" value={isLoading ? 0 : (data?.stats.totalProducts ?? 0)} icon={Package} description="In catalog" />
        <StatCard title="Low Stock" value={isLoading ? 0 : (data?.stats.lowStockCount ?? 0)} icon={AlertTriangle} description="Products below threshold" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 mb-6">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Daily Revenue — This Month</h2>
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
                <XAxis dataKey="_id" tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--color-muted-foreground)" }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--color-muted-foreground)" }} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#185FA5" strokeWidth={2} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Top 5 Products by Qty Sold</h2>
          {!isLoading && (data?.topProducts.length ?? 0) === 0 ? (
            <EmptyState title="No sales data" description="No confirmed orders yet." className="py-10" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.topProducts ?? []} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--color-muted-foreground)" }} />
                <YAxis type="category" dataKey="productName" width={80} tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 10) + "…" : v} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [v, "Units sold"]} />
                <Bar dataKey="totalQty" fill="#185FA5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Recent Orders</h2>
          {!isLoading && (data?.recentOrders.length ?? 0) === 0 ? (
            <EmptyState title="No orders yet" description="Orders will appear here once created." className="py-8" />
          ) : (
            <motion.ul variants={listVariants2} initial="hidden" animate="visible" className="divide-y divide-border" role="list">
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

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Low Stock Alerts</h2>
          {!isLoading && (data?.lowStockProducts.length ?? 0) === 0 ? (
            <EmptyState title="All stocked up" description="No products are below their low-stock threshold." icon={Package} className="py-8" />
          ) : (
            <motion.ul variants={listVariants2} initial="hidden" animate="visible" className="divide-y divide-border" role="list">
              {(data?.lowStockProducts ?? []).map((product) => (
                <motion.li key={product._id} variants={itemVariants} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                    <p className="font-mono text-xs text-muted-foreground tabular-nums">{product.sku}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    {product.quantity} left
                  </span>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </div>
      </div>
    </>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const role = useRole();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboard = useCallback(() => {
    setIsLoading(true);
    fetch("/api/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { toast.error(json.error); return; }
        setData(json as DashboardData);
      })
      .catch(() => toast.error("Failed to load dashboard data"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // Admin: listen for new orders from any tab and refresh dashboard
  useOrderNotifications(
    role === "admin" ? () => fetchDashboard() : undefined
  );

  return (
    <PageTransition>
      {role === "staff" ? (
        <StaffDashboard data={data?.role === "staff" ? data : null} isLoading={isLoading} />
      ) : (
        <AdminDashboard data={data?.role === "admin" ? data : null} isLoading={isLoading} />
      )}
    </PageTransition>
  );
}
