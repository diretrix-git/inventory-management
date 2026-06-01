"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import type { ColumnDef } from "@tanstack/react-table";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import type { IAuditLog } from "@/types";

type LogRow = Omit<IAuditLog, "_id" | "userId" | "targetId"> & {
  _id: string;
  userId: string;
  targetId?: string;
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/audit-logs?limit=100", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) { toast.error(friendlyError(json.error)); return; }
      setLogs((json.logs as LogRow[]).map((l) => ({ ...l, _id: String(l._id) })));
    } catch {
      toast.error("Connection error. Please check your internet and try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const columns: ColumnDef<LogRow>[] = [
    {
      accessorKey: "createdAt",
      header: "Timestamp",
      cell: ({ row }) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
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
        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-foreground">{row.original.action}</span>
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
      <PageHeader title="Audit Logs" description="All system actions, most recent first." />
      <DataTable columns={columns} data={logs} isLoading={isLoading} searchKey="action" searchPlaceholder="Search by action…" />
    </PageTransition>
  );
}
