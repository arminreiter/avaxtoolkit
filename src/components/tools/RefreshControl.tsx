"use client"

import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, relativeTime } from "@/lib/utils"
import { useNow } from "@/lib/hooks/use-now"

interface RefreshControlProps {
  /** Last successful update, in ms. */
  updatedAt: number | null
  loading?: boolean
  onRefresh: () => void
  autoRefresh?: boolean
  /** When provided, an auto-refresh toggle is shown. */
  onAutoRefreshChange?: (v: boolean) => void
}

export function RefreshControl({ updatedAt, loading, onRefresh, autoRefresh, onAutoRefreshChange }: RefreshControlProps) {
  useNow() // re-render every second so the "ago" label stays live
  const ago = updatedAt === null ? null : relativeTime(updatedAt / 1000)

  return (
    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
      {ago !== null && <span aria-live="polite">Updated {ago === "now" ? "just now" : `${ago} ago`}</span>}
      {onAutoRefreshChange && (
        <label className="flex items-center gap-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!autoRefresh}
            onChange={e => onAutoRefreshChange(e.target.checked)}
            className="accent-primary"
          />
          Auto
        </label>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onRefresh}
        disabled={loading}
        aria-label="Refresh"
        title="Refresh"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
      </Button>
    </div>
  )
}
