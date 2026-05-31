"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Download, Loader2, Eye, X } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tooltip } from "@/components/shared/Tooltip";
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
  const [viewInvoice, setViewInvoice] = useState<InvoiceRow | null>(null);

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
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const inv = row.original;
        const isDownloading = downloadingId === inv._id;
        return (
          <div className="flex items-center justify-end gap-1">
            <Tooltip content="View invoice details">
              <Button variant="ghost" size="icon-sm" onClick={() => setViewInvoice(inv)} aria-label={`View invoice ${inv.invoiceNumber}`}>
                <Eye className="size-3.5" aria-hidden="true" />
              </Button>
            </Tooltip>
            <Tooltip content="Download PDF">
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
                <span className="ml-1.5 text-xs hidden sm:inline">PDF</span>
              </Button>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader title="Invoices" description="View and download invoices." />
      <DataTable
        columns={columns}
        data={invoices}
        isLoading={isLoading}
        searchKey="issuedTo"
        searchPlaceholder="Search by customer…"
        emptyTitle="No invoices yet"
        emptyDescription="Invoices are created automatically when orders are placed."
      />

      {/* Invoice view modal */}
      {viewInvoice && (
        <dialog
          open
          className="fixed inset-0 z-50 m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border bg-popover p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm open:flex open:flex-col"
          aria-label={`Invoice details: ${viewInvoice.invoiceNumber}`}
          onClick={(e) => { if (e.target === e.currentTarget) setViewInvoice(null); }}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">Invoice Details</h2>
            <button onClick={() => setViewInvoice(null)} className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Close">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="overflow-y-auto p-5 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground mb-0.5">Invoice #</p><p className="font-mono font-semibold">{viewInvoice.invoiceNumber}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Status</p><StatusBadge status={viewInvoice.status} /></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Order #</p>
                <p className="font-mono text-xs">
                  {typeof viewInvoice.orderId === "object" && viewInvoice.orderId !== null ? viewInvoice.orderId.orderNumber : "—"}
                </p>
              </div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Date</p><p className="font-mono text-xs">{new Date(viewInvoice.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p></div>
              <div className="col-span-2"><p className="text-xs text-muted-foreground mb-0.5">Issued To</p><p className="font-medium">{viewInvoice.issuedTo}</p></div>
            </div>

            {/* Line items */}
            {viewInvoice.items && viewInvoice.items.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Items</p>
                <div className="rounded-lg border border-border overflow-hidden">
                  {viewInvoice.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 border-b border-border last:border-0 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.productName}</p>
                        <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="font-mono text-xs text-muted-foreground">×{item.quantity} @ ${item.unitPrice.toFixed(2)}</p>
                        <p className="font-mono text-sm font-semibold">${item.lineTotal.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">${viewInvoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax ({viewInvoice.taxRate}%)</span>
                <span className="font-mono tabular-nums">${viewInvoice.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1.5 mt-0.5">
                <span>Total</span>
                <span className="font-mono tabular-nums">${viewInvoice.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
            <Button variant="outline" onClick={() => handleDownload(viewInvoice)} disabled={downloadingId === viewInvoice._id}>
              {downloadingId === viewInvoice._id ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" aria-hidden="true" />
              ) : (
                <Download className="size-3.5 mr-1.5" aria-hidden="true" />
              )}
              Download PDF
            </Button>
            <Button variant="outline" onClick={() => setViewInvoice(null)}>Close</Button>
          </div>
        </dialog>
      )}
    </>
  );
}
