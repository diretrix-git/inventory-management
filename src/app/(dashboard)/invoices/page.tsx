"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import type { IInvoice } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceRow = Omit<IInvoice, "_id" | "orderId"> & {
  _id: string;
  orderId: { _id: string; orderNumber: string } | string;
};

// ─── InvoicesPage ─────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/invoices?limit=100", { cache: "no-store" });
      if (!res.ok) { toast.error("Failed to load invoices"); return; }
      const json = await res.json();
      setInvoices((json.invoices as InvoiceRow[]).map((i) => ({ ...i, _id: String(i._id) })));
    } catch {
      toast.error("Network error — could not load invoices");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  async function handleDownload(invoice: InvoiceRow) {
    setDownloadingId(invoice._id);
    try {
      const res = await fetch(`/api/invoices/${invoice._id}/pdf`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Failed to generate PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `INV-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Network error — could not download PDF");
    } finally {
      setDownloadingId(null);
    }
  }

  const columns: ColumnDef<InvoiceRow>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice #",
      cell: ({ row }) => (
        <span className="font-mono text-xs tabular-nums text-foreground">{row.original.invoiceNumber}</span>
      ),
    },
    {
      id: "orderNumber",
      header: "Order #",
      cell: ({ row }) => {
        const orderId = row.original.orderId;
        const orderNumber = typeof orderId === "object" && orderId !== null
          ? orderId.orderNumber
          : "—";
        return <span className="font-mono text-xs tabular-nums text-muted-foreground">{orderNumber}</span>;
      },
    },
    {
      accessorKey: "issuedTo",
      header: "Customer",
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.issuedTo}</span>,
    },
    {
      accessorKey: "totalAmount",
      header: "Total",
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums">${row.original.totalAmount.toFixed(2)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {new Date(row.original.createdAt).toLocaleDateString("en-US", {
            year: "numeric", month: "short", day: "2-digit",
          })}
        </span>
      ),
    },
    {
      id: "download",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const inv = row.original;
        const isDownloading = downloadingId === inv._id;
        return (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDownload(inv)}
              disabled={isDownloading}
              aria-label={`Download invoice ${inv.invoiceNumber}`}
            >
              {isDownloading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-3.5" aria-hidden="true" />
              )}
              <span className="ml-1.5 text-xs">PDF</span>
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title="Invoices" description="View and download invoices." />
      <DataTable columns={columns} data={invoices} isLoading={isLoading} searchKey="issuedTo" searchPlaceholder="Search by customer…" />
    </>
  );
}
