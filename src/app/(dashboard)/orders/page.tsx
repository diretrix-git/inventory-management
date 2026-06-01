"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, CheckCircle, XCircle, X } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ViewModal } from "@/components/shared/ViewModal";
import { Tooltip } from "@/components/shared/Tooltip";
import { Button } from "@/components/ui/button";
import { OrderForm } from "@/components/orders/OrderForm";
import { useRole } from "@/components/providers/RoleProvider";
import type { IOrder } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderRow = Omit<IOrder, "_id" | "createdBy"> & {
  _id: string;
  requiresApproval?: boolean;
  createdBy: { name?: string; email?: string } | string;
};

// ─── OrdersPage ───────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const role = useRole();
  const isAdmin = role === "admin";

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New order sheet
  const [sheetOpen, setSheetOpen] = useState(false);

  // Confirm dialogs
  const [confirmAction, setConfirmAction] = useState<{
    order: OrderRow;
    action: "confirmed" | "cancelled";
  } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [viewOrder, setViewOrder] = useState<OrderRow | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/orders?limit=100", { cache: "no-store" });
      if (!res.ok) { toast.error("Failed to load orders"); return; }
      const json = await res.json();
      setOrders((json.orders as OrderRow[]).map((o) => ({ ...o, _id: String(o._id) })));
    } catch {
      toast.error("Network error — could not load orders");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function handleStatusUpdate() {
    if (!confirmAction) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/orders/${confirmAction.order._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: confirmAction.action }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed to update order"); return; }
      toast.success(`Order ${confirmAction.action}`);
      setConfirmAction(null);
      await fetchOrders();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setIsUpdating(false);
    }
  }

  const columns: ColumnDef<OrderRow>[] = [
    {
      accessorKey: "orderNumber",
      header: "Order #",
      cell: ({ row }) => (
        <span className="font-mono text-xs tabular-nums text-foreground">{row.original.orderNumber}</span>
      ),
    },
    {
      accessorKey: "customerName",
      header: "Customer",
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.customerName}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const o = row.original;
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusBadge status={o.status} />
            {o.requiresApproval && o.status === "pending" && (
              <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
                Needs Approval
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "totalAmount",
      header: "Total",
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums">${row.original.totalAmount.toFixed(2)}</span>
      ),
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
    ...(isAdmin
      ? ([
          {
            id: "actions",
            header: "",
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => {
              const o = row.original;
              return (
                <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {o.status === "pending" && (
                    <Tooltip content="Confirm order">
                      <Button
                        variant="ghost" size="icon-sm"
                        onClick={() => setConfirmAction({ order: o, action: "confirmed" })}
                        aria-label="Confirm order"
                        className="text-[#1D9E75] hover:text-[#1D9E75] hover:bg-[#1D9E75]/10"
                      >
                        <CheckCircle className="size-3.5" aria-hidden="true" />
                      </Button>
                    </Tooltip>
                  )}
                  {(o.status === "pending" || o.status === "confirmed") && (
                    <Tooltip content="Cancel order">
                      <Button
                        variant="ghost" size="icon-sm"
                        onClick={() => setConfirmAction({ order: o, action: "cancelled" })}
                        aria-label="Cancel order"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="size-3.5" aria-hidden="true" />
                      </Button>
                    </Tooltip>
                  )}
                </div>
              );
            },
          },
        ] as ColumnDef<OrderRow>[])
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Orders"
        description="Manage customer orders."
        action={
          <Button onClick={() => setSheetOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            New Order
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={orders}
        isLoading={isLoading}
        searchKey="customerName"
        searchPlaceholder="Search by customer…"
        emptyTitle="No orders yet"
        emptyDescription="Create your first order using the button above."
        onRowClick={(o) => setViewOrder(o)}
      />

      {/* New Order Sheet */}
      {sheetOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" aria-hidden="true" onClick={() => setSheetOpen(false)} />
          <aside role="dialog" aria-modal="true" aria-label="New order" className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-popover shadow-2xl border-l border-border">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">New Order</h2>
              <button type="button" onClick={() => setSheetOpen(false)} className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Close panel">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <OrderForm
                onSuccess={() => { setSheetOpen(false); fetchOrders(); }}
                onCancel={() => setSheetOpen(false)}
              />
            </div>
          </aside>
        </>
      )}

      {/* Confirm status change */}
      {confirmAction && (
        <ConfirmDialog
          open={!!confirmAction}
          onOpenChange={(v) => { if (!v) setConfirmAction(null); }}
          title={confirmAction.action === "confirmed" ? "Confirm order?" : "Cancel order?"}
          description={
            confirmAction.action === "confirmed"
              ? `Order ${confirmAction.order.orderNumber} will be marked as confirmed.`
              : `Order ${confirmAction.order.orderNumber} will be cancelled${confirmAction.order.status === "confirmed" ? " and stock will be restored" : ""}.`
          }
          confirmLabel={confirmAction.action === "confirmed" ? "Confirm" : "Cancel Order"}
          destructive={confirmAction.action === "cancelled"}
          onConfirm={handleStatusUpdate}
          isLoading={isUpdating}
        />
      )}

      {/* Order view modal — opens on row click */}
      <ViewModal
        open={!!viewOrder}
        onClose={() => setViewOrder(null)}
        title="Order Details"
        footer={<Button variant="outline" onClick={() => setViewOrder(null)}>Close</Button>}
      >
        {viewOrder && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground mb-0.5">Order #</p><p className="font-mono font-semibold">{viewOrder.orderNumber}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Status</p><StatusBadge status={viewOrder.status} /></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Customer</p><p className="font-medium">{viewOrder.customerName}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Date</p><p className="font-mono text-xs">{new Date(viewOrder.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Subtotal</p><p className="font-mono">${viewOrder.subtotal.toFixed(2)}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Tax ({viewOrder.taxRate}%)</p><p className="font-mono">${viewOrder.taxAmount.toFixed(2)}</p></div>
              <div className="col-span-2 border-t border-border pt-2">
                <p className="text-xs text-muted-foreground mb-0.5">Total</p>
                <p className="font-mono text-lg font-semibold">${viewOrder.totalAmount.toFixed(2)}</p>
              </div>
            </div>
            {viewOrder.items && viewOrder.items.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Items</p>
                <div className="rounded-lg border border-border overflow-hidden">
                  {viewOrder.items.map((item, i) => (
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
            {viewOrder.notes && (
              <div><p className="text-xs text-muted-foreground mb-0.5">Notes</p><p className="text-sm text-muted-foreground">{viewOrder.notes}</p></div>
            )}
          </div>
        )}
      </ViewModal>
    </>
  );
}
