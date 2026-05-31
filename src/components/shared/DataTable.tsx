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
import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Eye, ChevronLeft, ChevronRight, Search, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";
import { Button } from "@/components/ui/button";

// ─── Levenshtein distance for fuzzy suggestions ───────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow({ widths }: { widths: number[] }) {
  return (
    <tr className="border-b border-border" aria-hidden="true">
      {widths.map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 rounded bg-muted animate-pulse"
            style={{ width: `${w}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

// Skeleton widths per column index — vary widths so it looks natural
const SKELETON_WIDTH_PATTERNS = [
  [60, 80, 50, 70, 40, 60, 30],
  [75, 65, 55, 80, 45, 55, 35],
  [50, 90, 60, 60, 50, 70, 25],
  [80, 70, 45, 75, 55, 65, 40],
  [65, 85, 50, 65, 40, 60, 30],
];

// ─── DataTable ────────────────────────────────────────────────────────────────

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  /** Error message — shows error state instead of table */
  error?: string | null;
  searchKey?: string;
  searchPlaceholder?: string;
  /** Displayed in empty state when no data at all (not filtered) */
  emptyTitle?: string;
  emptyDescription?: string;
  /** All string values from the data for fuzzy suggestion */
  fuzzyValues?: string[];
  /** Called when a row is clicked — enables row-click to open modal */
  onRowClick?: (row: TData) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  error = null,
  searchKey,
  searchPlaceholder = "Search…",
  emptyTitle = "No results",
  emptyDescription = "Nothing to show here yet.",
  fuzzyValues,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const totalRows = table.getFilteredRowModel().rows.length;

  // Current search query
  const searchQuery = searchKey
    ? (table.getColumn(searchKey)?.getFilterValue() as string ?? "")
    : globalFilter;

  // Fuzzy suggestion — find closest match when no results
  const suggestion = useMemo(() => {
    if (!searchQuery || totalRows > 0 || isLoading) return null;
    const candidates = fuzzyValues ?? (
      // Extract string values from data if no explicit fuzzyValues provided
      data.flatMap((row) =>
        Object.values(row as Record<string, unknown>)
          .filter((v): v is string => typeof v === "string")
      )
    );
    const unique = [...new Set(candidates.map((s) => s.toLowerCase()))];
    const q = searchQuery.toLowerCase();
    let best: string | null = null;
    let bestDist = Infinity;
    for (const candidate of unique) {
      const dist = levenshtein(q, candidate);
      // Only suggest if within edit distance of 3 and candidate is longer than query
      if (dist < bestDist && dist <= 3 && candidate.length >= q.length) {
        bestDist = dist;
        best = candidate;
      }
    }
    // Find original-cased version
    if (best) {
      const original = candidates.find((s) => s.toLowerCase() === best);
      return original ?? best;
    }
    return null;
  }, [searchQuery, totalRows, isLoading, data, fuzzyValues]);

  // Skeleton widths — use column count to pick pattern
  const skeletonWidths = useMemo(() => {
    const pattern = SKELETON_WIDTH_PATTERNS[0];
    return columns.map((_, i) => pattern[i % pattern.length] ?? 60);
  }, [columns]);

  function applySearch(value: string) {
    if (searchKey) {
      table.getColumn(searchKey)?.setFilterValue(value);
    } else {
      setGlobalFilter(value);
    }
  }

  // ── Error state ──────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 flex flex-col items-center text-center gap-3">
        <div className="flex items-center justify-center size-10 rounded-full bg-destructive/10">
          <SearchX className="size-5 text-destructive" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-foreground">Failed to load data</p>
        <p className="text-xs text-muted-foreground max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => applySearch(e.target.value)}
            placeholder={searchPlaceholder}
            className={cn(
              "h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-label="Search table"
          />
        </div>

        {/* Column visibility toggle */}
        <div className="relative flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibilityMenuOpen((v) => !v)}
            aria-label="Toggle column visibility"
            aria-expanded={visibilityMenuOpen}
          >
            <Eye className="size-3.5 mr-1.5" aria-hidden="true" />
            <span className="hidden sm:inline">Columns</span>
            <ChevronDown className="size-3.5 ml-1.5" aria-hidden="true" />
          </Button>

          {visibilityMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-border bg-popover shadow-md py-1"
              role="menu"
            >
              {table.getAllColumns().filter((col) => col.getCanHide()).map((col) => (
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
                        aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : canSort ? "none" : undefined}
                      >
                        <span className="inline-flex items-center gap-1">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            <span aria-hidden="true">
                              {sorted === "asc" ? <ChevronUp className="size-3" /> : sorted === "desc" ? <ChevronDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-40" />}
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
                Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonRow key={i} widths={skeletonWidths} />
                ))
              ) : table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "hover:bg-muted/40 transition-colors",
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-sm text-foreground">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Empty / no-results state */}
        {!isLoading && table.getRowModel().rows.length === 0 && (
          <div className="py-2">
            {searchQuery ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
                <div className="flex items-center justify-center size-12 rounded-full bg-muted">
                  <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    No results for &ldquo;{searchQuery}&rdquo;
                  </p>
                  {suggestion ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      Did you mean{" "}
                      <button
                        type="button"
                        onClick={() => applySearch(suggestion)}
                        className="font-medium text-primary underline underline-offset-2 hover:no-underline"
                      >
                        {suggestion}
                      </button>
                      ?
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">
                      Try a different search term or clear the filter.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => applySearch("")}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <EmptyState title={emptyTitle} description={emptyDescription} />
            )}
          </div>
        )}
      </div>

      {/* Pagination — only show when there's data */}
      {!isLoading && data.length > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap text-sm text-muted-foreground">
          <span className="text-xs">
            {totalRows === 0
              ? "No rows"
              : `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, totalRows)} of ${totalRows}`}
          </span>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label htmlFor="page-size" className="text-xs hidden sm:inline">Rows per page</label>
              <select
                id="page-size"
                value={pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
                <ChevronLeft className="size-3.5" aria-hidden="true" />
              </Button>
              <span className="text-xs px-2">
                {pageCount === 0 ? "0 / 0" : `${pageIndex + 1} / ${pageCount}`}
              </span>
              <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
