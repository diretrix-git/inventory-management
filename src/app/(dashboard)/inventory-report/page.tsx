"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";

interface ProductReport {
  _id: string;
  name: string;
  sku: string;
  category?: string;
  price: number;
  quantity: number;
  lowStockThreshold: number;
  totalStockValue: number;
  stockStatus: "low" | "ok";
}

export default function InventoryReportPage() {
  const [products, setProducts] = useState<ProductReport[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/inventory-report");
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed to load report"); return; }
      setProducts((json.products as ProductReport[]).map((p) => ({ ...p, _id: String(p._id) })));
      setTotalValue(json.totalInventoryValue as number);
    } catch {
      toast.error("Network error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function exportCsv() {
    const headers = ["Name", "SKU", "Category", "Unit Price", "Quantity", "Low Stock Threshold", "Total Stock Value", "Status"];
    const rows = products.map((p) => [
      p.name, p.sku, p.category ?? "", p.price, p.quantity, p.lowStockThreshold, p.totalStockValue, p.stockStatus,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "inventory-report.csv";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  const columns: ColumnDef<ProductReport>[] = [
    { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "sku", header: "SKU", cell: ({ row }) => <span className="font-mono text-xs tabular-nums">{row.original.sku}</span> },
    { accessorKey: "category", header: "Category", cell: ({ row }) => <span className="text-muted-foreground">{row.original.category ?? "—"}</span> },
    { accessorKey: "price", header: "Unit Price", cell: ({ row }) => <span className="font-mono text-sm tabular-nums">Rs {row.original.price.toFixed(2)}</span> },
    { accessorKey: "quantity", header: "Qty", cell: ({ row }) => <span className="font-mono text-sm tabular-nums">{row.original.quantity}</span> },
    { accessorKey: "lowStockThreshold", header: "Threshold", cell: ({ row }) => <span className="font-mono text-sm tabular-nums">{row.original.lowStockThreshold}</span> },
    { accessorKey: "totalStockValue", header: "Stock Value", cell: ({ row }) => <span className="font-mono text-sm tabular-nums font-semibold">Rs {row.original.totalStockValue.toFixed(2)}</span> },
    {
      accessorKey: "stockStatus", header: "Status",
      cell: ({ row }) => (
        <span className={row.original.stockStatus === "low"
          ? "inline-flex items-center rounded-full border border-warning/30 bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning"
          : "inline-flex items-center rounded-full border border-success/30 bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success"}>
          {row.original.stockStatus === "low" ? "Low" : "OK"}
        </span>
      ),
    },
  ];

  return (
    <PageTransition>
      <PageHeader
        title="Inventory Report"
        description={`Total inventory value: $Rs {totalValue.toFixed(2)}`}
        action={
          <Button variant="outline" onClick={exportCsv} disabled={isLoading}>
            <Download className="size-4" aria-hidden="true" />
            Export CSV
          </Button>
        }
      />
      <DataTable columns={columns} data={products} isLoading={isLoading} searchKey="name" searchPlaceholder="Search by name…" />
    </PageTransition>
  );
}
