"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";
import { Button } from "@/components/ui/button";

// ─── Skeleton row ────────────────────────────────────────────────────────────

function SkeletonRow({ columnCount }: { columnCount: number }) {
  return (
    <tr className="border-b border-border" aria-hidden="true">
      {Array.from({ length: columnCount }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-muted animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

// ─── DataTable ────────────────────────────────────────────────────────────────

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  searchKey?: string;
  searchPlaceholder?: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  searchKey,
  searchPlaceholder = "Search…",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 25 },
    },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const totalRows = table.getFilteredRowModel().rows.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Search */}
        <input
          type="search"
          value={searchKey ? (table.getColumn(searchKey)?.getFilterValue() as string ?? "") : globalFilter}
          onChange={(e) => {
            if (searchKey) {
              table.getColumn(searchKey)?.setFilterValue(e.target.value);
            } else {
              setGlobalFilter(e.target.value);
            }
          }}
          placeholder={searchPlaceholder}
          className={cn(
            "h-8 w-full max-w-xs rounded-lg border border-input bg-background px-3 text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label="Search table"
        />

        {/* Column visibility toggle */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibilityMenuOpen((v) => !v)}
            aria-label="Toggle column visibility"
            aria-expanded={visibilityMenuOpen}
          >
            <Eye className="size-3.5 mr-1.5" aria-hidden="true" />
            Columns
            <ChevronDown className="size-3.5 ml-1.5" aria-hidden="true" />
          </Button>

          {visibilityMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-border bg-popover shadow-md py-1"
              role="menu"
            >
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted"
                    role="menuitemcheckbox"
                    aria-checked={col.getIsVisible()}
                  >
                    <input
                      type="checkbox"
                      checked={col.getIsVisible()}
                      onChange={(e) => col.toggleVisibility(e.target.checked)}
                      className="size-3.5 rounded border-input accent-primary"
                    />
                    <span className="capitalize">{col.id}</span>
                  </label>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="grid">
            {/* Sticky header */}
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b border-border">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    const canSort = header.column.getCanSort();
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        className={cn(
                          "px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap",
                          canSort && "cursor-pointer select-none hover:text-foreground"
                        )}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        aria-sort={
                          sorted === "asc"
                            ? "ascending"
                            : sorted === "desc"
                            ? "descending"
                            : canSort
                            ? "none"
                            : undefined
                        }
                      >
                        <span className="inline-flex items-center gap-1">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span aria-hidden="true">
                              {sorted === "asc" ? (
                                <ChevronUp className="size-3" />
                              ) : sorted === "desc" ? (
                                <ChevronDown className="size-3" />
                              ) : (
                                <ChevronsUpDown className="size-3 opacity-40" />
                              )}
                            </span>
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-border bg-card">
              {isLoading ? (
                // Skeleton rows
                Array.from({ length: pageSize }).map((_, i) => (
                  <SkeletonRow key={i} columnCount={columns.length} />
                ))
              ) : table.getRowModel().rows.length === 0 ? null : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-muted/40 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-sm text-foreground">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Empty state — rendered outside the table to avoid invalid HTML */}
        {!isLoading && table.getRowModel().rows.length === 0 && (
          <EmptyState
            title="No results found"
            description="Try adjusting your search or filters."
          />
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-4 flex-wrap text-sm text-muted-foreground">
        {/* Row count info */}
        <span className="text-xs">
          {totalRows === 0
            ? "No rows"
            : `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, totalRows)} of ${totalRows}`}
        </span>

        <div className="flex items-center gap-3">
          {/* Page size selector */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="page-size" className="text-xs hidden sm:inline">
              Rows per page
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </Button>
            <span className="text-xs px-2">
              {pageCount === 0 ? "0 / 0" : `${pageIndex + 1} / ${pageCount}`}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
