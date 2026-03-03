export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-8">
      <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-8 bg-muted rounded animate-pulse" />
      ))}
    </div>
  )
}
