"use client"

import { useEffect, useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { Card, CardContent } from "@/components/ui/card"
import { InfoTooltip } from "@/components/tools/InfoTooltip"
import { Weight } from "lucide-react"

function formatAvax(nAvax: string): string {
  return (Number(nAvax) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function asciiBar(pct: number, width: number = 20): string {
  const filled = Math.round((pct / 100) * width)
  const empty = width - filled
  return "\u2588".repeat(filled) + "\u2591".repeat(empty)
}

interface StakingRatioProps {
  staked?: string | null
  supply?: string | null
}

export function StakingRatio({ staked: propStaked, supply: propSupply }: StakingRatioProps) {
  const { network } = useNetwork()
  const [fetchedStaked, setFetchedStaked] = useState<string | null>(null)
  const [fetchedSupply, setFetchedSupply] = useState<string | null>(null)
  const [loading, setLoading] = useState(!propStaked || !propSupply)

  // Only self-fetch when props are not provided
  useEffect(() => {
    if (propStaked != null && propSupply != null) return
    let cancelled = false
    async function fetchData() {
      const [stakeResult, supplyResult] = await Promise.allSettled([
        AvalancheService.getTotalStake(network.baseUrl),
        AvalancheService.getCurrentSupply(network.baseUrl),
      ])
      if (cancelled) return
      if (stakeResult.status === "fulfilled") setFetchedStaked(stakeResult.value.stake || stakeResult.value.weight)
      if (supplyResult.status === "fulfilled") setFetchedSupply(supplyResult.value.supply)
      setLoading(false)
    }
    fetchData()
    return () => { cancelled = true }
  }, [network.baseUrl, propStaked, propSupply])

  // Prefer props, fall back to self-fetched
  const staked = propStaked ?? fetchedStaked
  const supply = propSupply ?? fetchedSupply
  const ratio = staked && supply ? (Number(staked) / Number(supply)) * 100 : null

  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: "550ms" }}>
      {/* Terminal chrome header */}
      <div className="terminal-chrome-header">
        <Weight className="h-3 w-3 text-primary" />
        <span>staking.ratio</span>
        <span className="ml-auto"><InfoTooltip rpcMethod="platform.getTotalStake / platform.getCurrentSupply" /></span>
      </div>

      <CardContent className="pt-3 pb-3">
        {loading ? (
          <div className="space-y-2">
            <div className="h-5 shimmer w-1/3" />
            <div className="h-4 shimmer" />
            <div className="h-3 shimmer w-2/3" />
          </div>
        ) : (
          <div className="space-y-2">
            {ratio !== null && (
              <>
                <div className="flex items-baseline justify-between">
                  <p className="text-xl font-bold font-display tracking-tight">{ratio.toFixed(1)}%</p>
                  <p className="text-[11px] text-muted-foreground font-mono">of supply staked</p>
                </div>

                {/* ASCII-style progress bar */}
                <div className="font-mono text-xs">
                  <span className="text-primary">{asciiBar(ratio)}</span>
                  <span className="text-muted-foreground/30 ml-1">{ratio.toFixed(1)}%</span>
                </div>

                <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                  <span>staked: {formatAvax(staked!)} AVAX</span>
                  <span>supply: {formatAvax(supply!)} AVAX</span>
                </div>
              </>
            )}
            {ratio === null && (
              <p className="text-xs text-muted-foreground font-mono">error: unable to load staking data</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
