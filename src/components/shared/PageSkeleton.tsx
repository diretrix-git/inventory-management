/**
 * Generic page loading skeleton — used in route-level loading.tsx files.
 */
export function PageSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading…">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-7 w-40 rounded-lg bg-muted mb-2" />
          <div className="h-4 w-64 rounded-lg bg-muted" />
        </div>
        <div className="h-8 w-28 rounded-lg bg-muted" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex gap-4 px-4 py-3 bg-muted/80 border-b border-border">
          {[120, 160, 80, 100, 80].map((w, i) => (
            <div key={i} className="h-3 rounded bg-muted" style={{ width: w }} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3.5 border-b border-border last:border-0">
            {[120, 160, 80, 100, 80].map((w, j) => (
              <div key={j} className="h-3.5 rounded bg-muted" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
