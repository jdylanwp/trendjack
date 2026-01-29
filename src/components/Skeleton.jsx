export function Skeleton({ className = '', width = 'w-full', height = 'h-4' }) {
  return (
    <div
      className={`animate-pulse bg-slate-700 rounded ${width} ${height} ${className}`}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="terminal-card">
      <div className="flex items-center gap-3">
        <Skeleton width="w-12" height="h-12" className="rounded-lg" />
        <div className="flex-1">
          <Skeleton width="w-24" height="h-3" className="mb-2" />
          <Skeleton width="w-16" height="h-6" />
        </div>
      </div>
    </div>
  );
}

export function LeadCardSkeleton() {
  return (
    <div className="terminal-card">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <Skeleton width="w-3/4" height="h-6" className="mb-2" />
          <div className="flex items-center gap-4 mb-3">
            <Skeleton width="w-24" height="h-4" />
            <Skeleton width="w-32" height="h-4" />
            <Skeleton width="w-28" height="h-4" />
          </div>
        </div>
        <Skeleton width="w-12" height="h-8" />
      </div>

      <div className="mb-4">
        <Skeleton width="w-24" height="h-4" className="mb-2" />
        <Skeleton width="w-full" height="h-16" />
      </div>

      <div className="mb-4">
        <Skeleton width="w-32" height="h-4" className="mb-2" />
        <Skeleton width="w-full" height="h-24" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <Skeleton width="w-28" height="h-10" />
          <Skeleton width="w-24" height="h-10" />
        </div>
        <div className="flex gap-2">
          <Skeleton width="w-32" height="h-10" />
          <Skeleton width="w-24" height="h-10" />
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="terminal-card">
      <Skeleton width="w-48" height="h-6" className="mb-4" />
      <div className="space-y-3">
        <div className="flex items-end gap-2 h-64">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              width="w-full"
              height={`h-${Math.floor(Math.random() * 48) + 16}`}
            />
          ))}
        </div>
        <div className="flex justify-between">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="w-16" height="h-3" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="terminal-card">
      <Skeleton width="w-48" height="h-6" className="mb-4" />
      <div className="overflow-x-auto">
        <table className="terminal-table">
          <thead>
            <tr>
              <th><Skeleton width="w-24" height="h-4" /></th>
              <th><Skeleton width="w-32" height="h-4" /></th>
              <th><Skeleton width="w-20" height="h-4" /></th>
              <th><Skeleton width="w-36" height="h-4" /></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                <td><Skeleton width="w-28" height="h-4" /></td>
                <td><Skeleton width="w-24" height="h-4" /></td>
                <td><Skeleton width="w-16" height="h-4" /></td>
                <td><Skeleton width="w-32" height="h-4" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
