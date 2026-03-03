"use client"

import { useEffect, useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { relativeTime, formatGas, gasPercent, gasColor } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Blocks } from "lucide-react"

interface BlockData {
  number: number
  txCount: number
  timestamp: number
  gasUsed: number
  gasLimit: number
}

export function RecentBlocks() {
  const { endpoints } = useNetwork()
  const [blocks, setBlocks] = useState<BlockData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchBlocks() {
      try {
        const latest = await CChainService.getBlock(endpoints.cChain, "latest")
        if (!latest || cancelled) return
        const restBlockNumbers = Array.from({ length: 4 }, (_, i) => latest.number - (i + 1))
        const restFetched = await Promise.all(
          restBlockNumbers.map(n => CChainService.getBlock(endpoints.cChain, n))
        )
        if (!cancelled) {
          const allBlocks = [latest, ...restFetched]
          setBlocks(
            allBlocks
              .filter((b): b is NonNullable<typeof b> => b !== null)
              .map(b => ({
                number: b.number,
                txCount: b.transactions.length,
                timestamp: b.timestamp,
                gasUsed: Number(b.gasUsed),
                gasLimit: Number(b.gasLimit),
              }))
          )
        }
      } catch {
        /* silently fail */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchBlocks()
    return () => {
      cancelled = true
    }
  }, [endpoints.cChain])

  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: "600ms" }}>
      {/* Terminal chrome header */}
      <div className="terminal-chrome-header">
        <Blocks className="h-3 w-3 text-cyan-400" />
        <span>cchain.blocks --recent</span>
      </div>

      <CardContent className="pt-2 pb-2">
        {loading ? (
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 shimmer" />
            ))}
          </div>
        ) : (
          <div className="font-mono text-[13px]">
            {/* Column headers */}
            <div className="flex items-center gap-3 py-1.5 text-[11px] text-muted-foreground/40 uppercase tracking-wider border-b border-border/50">
              <span className="min-w-[90px]">block</span>
              <span className="min-w-[40px]">txs</span>
              <span className="min-w-[60px]">gas</span>
              <span className="ml-auto">age</span>
            </div>

            {blocks.map((block) => {
              const gasPct = gasPercent(block.gasUsed, block.gasLimit)
              return (
                <div
                  key={block.number}
                  className="flex items-center gap-3 py-1.5 border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <span className="text-primary font-semibold min-w-[90px]">
                    #{block.number.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground min-w-[40px]">
                    {block.txCount}
                  </span>
                  <span className={`min-w-[60px] ${gasColor(gasPct)}`} title={`${gasPct}% (${formatGas(block.gasUsed)}/${formatGas(block.gasLimit)})`}>
                    {formatGas(block.gasUsed)} <span className="text-muted-foreground/30">{gasPct}%</span>
                  </span>
                  <span className="text-muted-foreground/50 ml-auto">
                    {relativeTime(block.timestamp)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
