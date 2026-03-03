"use client"

import { useEffect, useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity } from "lucide-react"
import { InfoTooltip } from "@/components/tools/InfoTooltip"

export function NetworkHealth() {
  const { network } = useNetwork()
  const [healthy, setHealthy] = useState<boolean | null>(null)
  const [peerCount, setPeerCount] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetch() {
      setLoading(true)
      const [healthResult, peersResult] = await Promise.allSettled([
        AvalancheService.healthCheck(network.baseUrl),
        AvalancheService.getPeers(network.baseUrl),
      ])
      if (cancelled) return
      if (healthResult.status === "fulfilled") setHealthy(healthResult.value.healthy)
      if (peersResult.status === "fulfilled") setPeerCount(peersResult.value.numPeers)
      setLoading(false)
    }
    fetch()
    return () => { cancelled = true }
  }, [network.baseUrl])

  return (
    <Card className="animate-fade-in-up" style={{ animationDelay: "500ms" }}>
      {/* Terminal chrome header */}
      <div className="terminal-chrome-header">
        <Activity className={`h-3 w-3 ${healthy === false ? "text-red-500" : healthy ? "text-[#007700] dark:text-[#00ff41]" : "text-muted-foreground"}`} />
        <span>health.status</span>
        <span className="ml-auto"><InfoTooltip rpcMethod="health.health" /></span>
      </div>

      <CardContent className="pt-3 pb-3">
        {loading ? (
          <div className="space-y-2">
            <div className="h-5 w-32 shimmer" />
            <div className="h-4 w-24 shimmer" />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-muted-foreground/40">status:</span>
              {healthy !== null ? (
                <Badge
                  variant={healthy ? "default" : "destructive"}
                  className={healthy ? "bg-[#007700] dark:bg-[#005500] text-white border-[#007700]/30 dark:border-[#00ff41]/30" : ""}
                >
                  {healthy ? "HEALTHY" : "DEGRADED"}
                </Badge>
              ) : (
                <Badge variant="outline">UNKNOWN</Badge>
              )}
            </div>
            {peerCount !== null && (
              <div className="font-mono text-xs">
                <span className="text-muted-foreground/40">peers: </span>
                <span className="text-foreground">{peerCount}</span>
                <span className="text-muted-foreground/30"> nodes connected</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
