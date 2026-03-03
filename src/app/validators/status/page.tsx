"use client"

import { useState, useCallback } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { DetailGrid } from "@/components/tools/DetailGrid"
import { InfoTooltip } from "@/components/tools/InfoTooltip"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { AlertTriangle, CircleCheck, XCircle, Info, CheckCircle2 } from "lucide-react"

import { TimeProgress } from "@/components/tools/TimeProgress"

interface Validator {
  nodeID: string
  uptime?: string
  connected: boolean
  startTime?: string
  endTime?: string
}

interface PeerInfo {
  numPeers: string
  peers: unknown[]
}

interface HealthResult {
  healthy: boolean
  checks: Record<string, unknown>
}

interface Finding {
  severity: "ok" | "warning" | "critical" | "info"
  message: string
}

function getUptimeColor(uptimePercent: number): string {
  if (uptimePercent > 80) return "text-green-500"
  if (uptimePercent > 60) return "text-yellow-500"
  return "text-red-500"
}

function getUptimeBarColor(uptimePercent: number): string {
  if (uptimePercent > 80) return "bg-green-500"
  if (uptimePercent > 60) return "bg-yellow-500"
  return "bg-red-500"
}

function FindingIcon({ severity }: { severity: Finding["severity"] }) {
  switch (severity) {
    case "ok":
      return <CircleCheck className="h-5 w-5 text-green-500 shrink-0" />
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
    case "critical":
      return <XCircle className="h-5 w-5 text-red-500 shrink-0" />
    case "info":
      return <Info className="h-5 w-5 text-blue-500 shrink-0" />
  }
}

function generateFindings(
  validator: Validator,
  uptimePercent: number | null,
  peerInfo: PeerInfo | null,
  health: HealthResult | null,
  recoveryDays: number | null,
): Finding[] {
  const findings: Finding[] = []

  if (!validator.connected) {
    findings.push({
      severity: "critical",
      message: "Validator is currently offline as seen by this RPC node. Check that your node is running and port 9651 is accessible.",
    })
  }

  if (uptimePercent !== null) {
    if (uptimePercent >= 80 && validator.connected) {
      findings.push({
        severity: "ok",
        message: "Validator uptime is healthy and above the 80% reward threshold.",
      })
    } else if (uptimePercent < 80 && uptimePercent >= 60) {
      findings.push({
        severity: "warning",
        message: `Uptime is below the 80% reward threshold.${recoveryDays !== null ? ` Estimated ${recoveryDays} days of continuous uptime needed to recover.` : ""}`,
      })
    } else if (uptimePercent < 60) {
      findings.push({
        severity: "critical",
        message: `Uptime is critically low (${uptimePercent.toFixed(2)}%). Validator is likely not earning rewards.${recoveryDays !== null ? ` Estimated ${recoveryDays} days of continuous uptime needed to recover.` : ""}`,
      })
    }
  }

  if (peerInfo) {
    const peerCount = parseInt(peerInfo.numPeers, 10)
    if (peerCount < 10) {
      findings.push({
        severity: "info",
        message: `The connected RPC node has a low peer count (${peerCount}). Uptime measurement may be less representative.`,
      })
    }
  }

  if (health && !health.healthy) {
    findings.push({
      severity: "info",
      message: "The connected RPC node reports unhealthy status. Uptime data may be unreliable.",
    })
  }

  if (validator.startTime) {
    const elapsed = Date.now() / 1000 - Number(validator.startTime)
    if (elapsed < 7 * 86400) {
      findings.push({
        severity: "info",
        message: "Validator has been staking for less than a week. Uptime may still be stabilizing.",
      })
    }
  }

  return findings
}

const recommendations = [
  "Ensure staking port (9651) is open and forwarded",
  "Set --public-ip or --public-ip-resolution-service correctly",
  "Monitor node resources (CPU, RAM, disk I/O)",
  "Maintain sufficient peers (target 20+)",
  "Keep node software up to date",
  "Consider a dedicated machine with stable internet",
  "Query uptime from your own node to compare perspectives (switch network in dropdown)",
]

export default function ValidatorStatusPage() {
  const { network } = useNetwork()
  const [nodeId, setNodeId] = useState("")
  const [validator, setValidator] = useState<Validator | null>(null)
  const [peerInfo, setPeerInfo] = useState<PeerInfo | null>(null)
  const [health, setHealth] = useState<HealthResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fetched, setFetched] = useState(false)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  const handleLookup = useCallback(async () => {
    if (!nodeId.trim()) return
    setLoading(true)
    setError("")
    setValidator(null)
    setPeerInfo(null)
    setHealth(null)
    setFetched(false)
    clearRaw()
    try {
      const result = await AvalancheService.getValidatorByNodeId(
        network.baseUrl,
        nodeId.trim(),
      )
      if (!result) {
        setError("Validator not found for the given Node ID.")
        setFetched(true)
        setLoading(false)
        return
      }
      setValidator(result as Validator)

      const [peersResult, healthResult] = await Promise.allSettled([
        AvalancheService.getPeers(network.baseUrl),
        AvalancheService.healthCheck(network.baseUrl),
      ])

      if (peersResult.status === "fulfilled") {
        setPeerInfo(peersResult.value)
      }
      if (healthResult.status === "fulfilled") {
        setHealth(healthResult.value)
      }

      captureRaw()
      setFetched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch validator data")
      setFetched(true)
    } finally {
      setLoading(false)
    }
  }, [network.baseUrl, nodeId, clearRaw, captureRaw])

  const uptimePercent = validator?.uptime
    ? parseFloat(validator.uptime)
    : null

  let recoveryDays: number | null = null
  if (uptimePercent !== null && uptimePercent < 80 && validator?.startTime) {
    const uptimeRatio = uptimePercent / 100
    const elapsed = Date.now() / 1000 - Number(validator.startTime)
    const recoverySeconds = elapsed * (0.8 - uptimeRatio) / 0.2
    recoveryDays = Math.ceil(recoverySeconds / 86400)
  }

  const findings = validator
    ? generateFindings(validator, uptimePercent, peerInfo, health, recoveryDays)
    : []

  return (
    <ToolCard
      title="Validator Status"
      description="Check uptime, diagnose issues, and get actionable recommendations for your validator."
      rawJson={rawJson}
    >
      <div className="space-y-6">
        <div className="space-y-4">
          <FormField
            label="Node ID"
            id="node-id"
            value={nodeId}
            onChange={setNodeId}
            placeholder="NodeID-..."
            monospace
          />
          <LoadingButton loading={loading} onClick={handleLookup}>
            Check Status
          </LoadingButton>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {fetched && validator && (
          <div className="space-y-6">
            {/* Section 1: Uptime Overview (always visible) */}
            <DetailGrid
              title="Uptime Overview"
              rpcMethod="platform.getCurrentValidators"
              columns={3}
              items={[
                {
                  label: "Uptime",
                  value: uptimePercent !== null ? (
                    <p className={`text-lg font-bold ${getUptimeColor(uptimePercent)}`}>
                      {uptimePercent.toFixed(2)}%
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">N/A</p>
                  ),
                },
                {
                  label: "Connected",
                  value: validator.connected ? (
                    <Badge variant="default">Online</Badge>
                  ) : (
                    <Badge variant="destructive">Offline</Badge>
                  ),
                },
                {
                  label: "Reward Eligible",
                  value: uptimePercent === null ? (
                    <span className="text-sm text-muted-foreground">N/A</span>
                  ) : uptimePercent >= 80 ? (
                    <Badge variant="default">Yes</Badge>
                  ) : (
                    <Badge variant="destructive">No</Badge>
                  ),
                },
                {
                  label: "Node ID",
                  value: validator.nodeID,
                  mono: true,
                  copyable: true,
                  fullWidth: true,
                },
              ]}
            />

            {/* Expandable diagnostics sections */}
            <Accordion type="multiple" defaultValue={["analysis", "connectivity", "findings", "recommendations"]}>
              {/* Section 2: Uptime Analysis */}
              <AccordionItem value="analysis">
                <AccordionTrigger className="text-lg font-semibold">
                  <span className="flex items-center gap-1.5">
                    Uptime Analysis
                    <InfoTooltip rpcMethod="platform.getCurrentValidators" />
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardContent className="pt-6 space-y-4">
                      {uptimePercent !== null && (
                        <div className="space-y-2">
                          <div className="flex items-baseline justify-between">
                            <p className="text-sm font-medium">Uptime</p>
                            <p className={`text-sm font-semibold ${getUptimeColor(uptimePercent)}`}>
                              {uptimePercent.toFixed(2)}%
                            </p>
                          </div>
                          <div className="relative">
                            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${getUptimeBarColor(uptimePercent)}`}
                                style={{ width: `${Math.min(uptimePercent, 100)}%` }}
                              />
                            </div>
                            <div
                              className="absolute top-0 h-3 border-l-2 border-dashed border-foreground/50"
                              style={{ left: "80%" }}
                            />
                            <div
                              className="absolute -bottom-4 text-[10px] text-muted-foreground"
                              style={{ left: "80%", transform: "translateX(-50%)" }}
                            >
                              80%
                            </div>
                          </div>
                        </div>
                      )}

                      {validator.startTime && validator.endTime && (
                        <div className="pt-4 space-y-2">
                          <p className="text-sm font-medium">Staking Period</p>
                          <TimeProgress startTime={validator.startTime} endTime={validator.endTime} />
                          <p className="text-xs text-muted-foreground">
                            Total duration: {Math.round((Number(validator.endTime) - Number(validator.startTime)) / 86400)} days
                          </p>
                        </div>
                      )}

                      {uptimePercent !== null && uptimePercent < 80 && recoveryDays !== null ? (
                        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">Recovery Estimate</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Approximately <span className="font-semibold text-foreground">{recoveryDays} days</span> of
                                continuous uptime needed to reach the 80% reward threshold.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : uptimePercent !== null && uptimePercent >= 80 ? (
                        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                          <div className="flex items-start gap-2">
                            <CircleCheck className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">On Track for Rewards</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Uptime is above the 80% threshold. Keep your node running to maintain eligibility.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>

              {/* Section 3: Network Connectivity */}
              <AccordionItem value="connectivity">
                <AccordionTrigger className="text-lg font-semibold">
                  <span className="flex items-center gap-1.5">
                    Network Connectivity
                    <InfoTooltip rpcMethod="info.peers / health.health" />
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <div className="rounded-lg border bg-muted/50 p-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Shows info about the RPC node you are connected to, not the queried validator.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-xs text-muted-foreground mb-1">Peer Count</p>
                          <p className="text-lg font-semibold">
                            {peerInfo?.numPeers ?? "N/A"}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-xs text-muted-foreground mb-1">Health Status</p>
                          {health ? (
                            <Badge variant={health.healthy ? "default" : "destructive"}>
                              {health.healthy ? "Healthy" : "Unhealthy"}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Unavailable</span>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Section 4: Diagnostic Findings */}
              <AccordionItem value="findings">
                <AccordionTrigger className="text-lg font-semibold">
                  Diagnostic Findings
                </AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardContent className="pt-6">
                      {findings.length > 0 ? (
                        <ul className="space-y-3">
                          {findings.map((finding, i) => (
                            <li key={i} className="flex items-start gap-3">
                              <FindingIcon severity={finding.severity} />
                              <p className="text-sm">{finding.message}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No findings to report.</p>
                      )}
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>

              {/* Section 5: Recommendations */}
              <AccordionItem value="recommendations">
                <AccordionTrigger className="text-lg font-semibold">
                  Recommendations
                </AccordionTrigger>
                <AccordionContent>
                  <Card>
                    <CardContent className="pt-6">
                      <ul className="space-y-2">
                        {recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <p className="text-sm text-muted-foreground">{rec}</p>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </div>
    </ToolCard>
  )
}
