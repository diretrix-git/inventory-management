"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import type { IOrder } from "@/types";

interface SalesSummary {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  distinctSkus: number;
}

type OrderRow = Omit<IOrder, "_id" | "createdBy"> & { _id: string };

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

export default function SalesReportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sales-report?startDate=${startDate}&endDate=${endDate}`);
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed to load report"); return; }
      setSummary(json.summary as SalesSummary);
      setOrders((json.orders as OrderRow[]).map((o) => ({ ...o, _id: String(o._id) })));
    } catch {
      toast.error("Network error");
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function exportCsv() {
    const headers = ["Order #", "Customer", "Date", "Subtotal", "Tax Rate", "Tax Amount", "Total"];
    const rows = orders.map((o) => [
      o.orderNumber, o.customerName,
      new Date(o.createdAt).toISOString().slice(0, 10),
      o.subtotal, o.taxRate, o.taxAmount, o.totalAmount,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "sales-report.csv";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  const columns: ColumnDef<OrderRow>[] = [
    { accessorKey: "orderNumber", header: "Order #", cell: ({ row }) => <span className="font-mono text-xs tabular-nums">{row.original.orderNumber}</span> },
    { accessorKey: "customerName", header: "Customer", cell: ({ row }) => <span className="font-medium">{row.original.customerName}</span> },
    { accessorKey: "createdAt", header: "Date", cell: ({ row }) => <span className="font-mono text-xs tabular-nums text-muted-foreground">{new Date(row.original.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })}</span> },
    { accessorKey: "subtotal", header: "Subtotal", cell: ({ row }) => <span className="font-mono text-sm tabular-nums">Rs {row.original.subtotal.toFixed(2)}</span> },
    { accessorKey: "taxAmount", header: "Tax", cell: ({ row }) => <span className="font-mono text-sm tabular-nums">Rs {row.original.taxAmount.toFixed(2)}</span> },
    { accessorKey: "totalAmount", header: "Total", cell: ({ row }) => <span className="font-mono text-sm tabular-nums font-semibold">Rs {row.original.totalAmount.toFixed(2)}</span> },
  ];

  return (
    <PageTransition>
      <PageHeader
        title="Sales Report"
        description="Confirmed orders only."
        action={
          <div className="flex items-center gap-3 flex-wrap">
            <DateRangePicker startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
            <Button variant="outline" onClick={exportCsv} disabled={isLoading}>
              <Download className="size-4" aria-hidden="true" />
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
          {[
            { label: "Total Revenue", value: `Rs Rs {summary.totalRevenue.toFixed(2)}` },
            { label: "Total Orders", value: summary.totalOrders.toString() },
            { label: "Avg Order Value", value: `Rs Rs {summary.avgOrderValue.toFixed(2)}` },
            { label: "Distinct SKUs Sold", value: summary.distinctSkus.toString() },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className="font-mono text-xl font-semibold tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <DataTable columns={columns} data={orders} isLoading={isLoading} searchKey="customerName" searchPlaceholder="Search by customer…" />
    </PageTransition>
  );
}
