import { useState, useEffect } from "react"
import { formatTimestamp } from "@/lib/utils"

export function TimeProgress({ startTime, endTime }: { startTime: string; endTime: string }) {
  const [now, setNow] = useState(() => Date.now() / 1000)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 60_000)
    return () => clearInterval(id)
  }, [])

  const start = Number(startTime)
  const end = Number(endTime)
  const total = end - start
  const elapsed = now - start
  const pct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0
  const remaining = Math.max(0, end - now)
  const days = Math.floor(remaining / 86400)
  const hours = Math.floor((remaining % 86400) / 3600)

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatTimestamp(startTime)}</span>
        <span>{formatTimestamp(endTime)}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {days > 0 ? `${days}d ${hours}h remaining` : `${hours}h remaining`} ({pct.toFixed(1)}% elapsed)
      </p>
    </div>
  )
}
