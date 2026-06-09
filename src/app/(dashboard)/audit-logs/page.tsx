"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { Filter, X } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import type { IAuditLog } from "@/types";

type LogRow = Omit<IAuditLog, "_id" | "userId" | "targetId"> & {
  _id: string;
  userId: string;
  targetId?: string;
};

// ─── Action type options ──────────────────────────────────────────────────────

const ACTION_TYPES = [
  "product.created", "product.updated", "product.deleted",
  "order.created", "order.approved", "order.cancelled", "order.updated",
  "invoice.downloaded",
  "user.created", "user.updated", "user.deactivated",
  "supplier.created", "supplier.updated", "supplier.deleted",
  "settings.updated",
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [filterAction, setFilterAction] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const hasFilters = filterAction || filterStartDate || filterEndDate;

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filterAction) params.set("action", filterAction);
      if (filterStartDate) params.set("startDate", filterStartDate);
      if (filterEndDate) params.set("endDate", filterEndDate);

      const res = await fetch(`/api/audit-logs?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) { toast.error(friendlyError(json.error)); return; }
      setLogs((json.logs as LogRow[]).map((l) => ({ ...l, _id: String(l._id) })));
    } catch {
      toast.error("Connection error. Please check your internet and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [filterAction, filterStartDate, filterEndDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  function clearFilters() {
    setFilterAction("");
    setFilterStartDate("");
    setFilterEndDate("");
  }

  const columns: ColumnDef<LogRow>[] = [
    {
      accessorKey: "createdAt",
      header: "Timestamp",
      cell: ({ row }) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground whitespace-nowrap">
          {new Date(row.original.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </span>
      ),
    },
    {
      accessorKey: "userName",
      header: "User",
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.userName}</span>,
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-foreground whitespace-nowrap">
          {row.original.action}
        </span>
      ),
    },
    {
      accessorKey: "targetModel",
      header: "Resource",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.targetModel}</span>,
    },
    {
      accessorKey: "targetId",
      header: "Resource ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums truncate max-w-[120px] block">
          {row.original.targetId ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <PageTransition>
      <PageHeader
        title="Audit Logs"
        description="All system actions are logged here. Use the Filters button to narrow by action type or date range."
        action={
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="size-3.5 mr-1.5" aria-hidden="true" />
            Filters
            {hasFilters && (
              <span className="ml-1.5 inline-flex items-center justify-center size-4 rounded-full bg-primary-foreground text-primary text-[10px] font-bold">
                {[filterAction, filterStartDate, filterEndDate].filter(Boolean).length}
              </span>
            )}
          </Button>
        }
      />

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-4 rounded-xl border border-border bg-card p-4 flex flex-wrap items-end gap-4">
          {/* Action type */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <label className="text-xs font-medium text-muted-foreground">Action type</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All actions</option>
              {ACTION_TYPES.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <input
              type="date"
              value={filterStartDate}
              max={today}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <input
              type="date"
              value={filterEndDate}
              max={today}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Quick presets */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Quick range</label>
            <div className="flex gap-1.5">
              {[
                { label: "Today", start: today, end: today },
                { label: "Last 7d", start: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), end: today },
                { label: "Last 30d", start: thirtyDaysAgo, end: today },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => { setFilterStartDate(preset.start); setFilterEndDate(preset.end); }}
                  className="h-8 px-2.5 rounded-lg border border-input bg-background text-xs hover:bg-muted transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear */}
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="self-end">
              <X className="size-3.5 mr-1" aria-hidden="true" />
              Clear
            </Button>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        searchKey="action"
        searchPlaceholder="Search by action or user…"
        emptyTitle="No audit logs"
        emptyDescription={hasFilters ? "No results for the selected filters. Try adjusting them." : "No system actions have been recorded yet."}
      />
    </PageTransition>
  );
}
