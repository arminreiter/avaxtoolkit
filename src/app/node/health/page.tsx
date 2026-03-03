"use client"

import { useState, useCallback } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { ToolCard } from "@/components/tools/ToolCard"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { OutputDisplay } from "@/components/tools/OutputDisplay"
import { SectionHeading } from "@/components/tools/SectionHeading"
import { InfoCard } from "@/components/tools/InfoCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface HealthResult {
  healthy: boolean
  checks: Record<string, unknown>
}

export default function NodeHealthPage() {
  const { network } = useNetwork()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [liveness, setLiveness] = useState<{ healthy: boolean } | null>(null)
  const [readiness, setReadiness] = useState<HealthResult | null>(null)
  const [fullHealth, setFullHealth] = useState<HealthResult | null>(null)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError("")
    setLiveness(null)
    setReadiness(null)
    setFullHealth(null)
    clearRaw()
    try {
      const [livenessResult, readinessResult, healthResult] =
        await Promise.allSettled([
          AvalancheService.healthLiveness(network.baseUrl),
          AvalancheService.healthReadiness(network.baseUrl),
          AvalancheService.healthCheck(network.baseUrl),
        ])

      if (livenessResult.status === "fulfilled") {
        setLiveness(livenessResult.value)
      }
      if (readinessResult.status === "fulfilled") {
        setReadiness(readinessResult.value)
      }
      if (healthResult.status === "fulfilled") {
        setFullHealth(healthResult.value)
      }

      captureRaw()

      if (
        livenessResult.status === "rejected" &&
        readinessResult.status === "rejected" &&
        healthResult.status === "rejected"
      ) {
        setError("All health checks failed. The node may be unreachable or the Health API may not be available.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch health data")
    } finally {
      setLoading(false)
    }
  }, [network.baseUrl, clearRaw, captureRaw])

  return (
    <ToolCard
      title="Node Health"
      description="Check the health, readiness, and liveness status of the connected Avalanche node."
      rawJson={rawJson}
    >
      <div className="space-y-6">
        <LoadingButton loading={loading} onClick={fetchHealth}>
          Run Health Checks
        </LoadingButton>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {(liveness || readiness || fullHealth) && (
          <div className="space-y-6">
            {/* Quick Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InfoCard label="Liveness" rpcMethod="health.liveness">
                {liveness ? (
                  <Badge variant={liveness.healthy ? "default" : "destructive"}>
                    {liveness.healthy ? "Alive" : "Not Alive"}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Unavailable</span>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Minimal check: is the node process running?
                </p>
              </InfoCard>

              <InfoCard label="Readiness" rpcMethod="health.readiness">
                {readiness ? (
                  <Badge variant={readiness.healthy ? "default" : "destructive"}>
                    {readiness.healthy ? "Ready" : "Not Ready"}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Unavailable</span>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Is the node ready to serve requests?
                </p>
              </InfoCard>

              <InfoCard label="Overall Health" rpcMethod="health.health">
                {fullHealth ? (
                  <Badge variant={fullHealth.healthy ? "default" : "destructive"}>
                    {fullHealth.healthy ? "Healthy" : "Unhealthy"}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Unavailable</span>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Full diagnostic health check.
                </p>
              </InfoCard>
            </div>

            {/* Readiness Checks Detail */}
            {readiness && readiness.checks && Object.keys(readiness.checks).length > 0 && (
              <div className="space-y-3">
                <SectionHeading title="Readiness Checks" rpcMethod="health.readiness" />
                <OutputDisplay
                  label="Readiness Checks"
                  value={JSON.stringify(readiness.checks, null, 2)}
                />
              </div>
            )}

            {/* Full Health Checks Detail */}
            {fullHealth && fullHealth.checks && Object.keys(fullHealth.checks).length > 0 && (
              <div className="space-y-3">
                <SectionHeading title="Health Checks Detail" rpcMethod="health.health" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(fullHealth.checks).map(([name, check]) => {
                    const checkObj = check as Record<string, unknown> | null
                    const message = checkObj?.message as Record<string, unknown> | undefined
                    const isHealthy = message?.["healthy"]
                    return (
                      <Card key={name}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium text-muted-foreground truncate">
                              {name}
                            </CardTitle>
                            {typeof isHealthy === "boolean" && (
                              <Badge variant={isHealthy ? "default" : "destructive"} className="shrink-0 ml-2">
                                {isHealthy ? "OK" : "Fail"}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-32 overflow-auto">
                            {JSON.stringify(checkObj, null, 2)}
                          </pre>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolCard>
  )
}
