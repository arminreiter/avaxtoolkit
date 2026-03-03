"use client"

import { useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { DataTable } from "@/components/tools/DataTable"
import { SectionHeading } from "@/components/tools/SectionHeading"
import { InfoCard } from "@/components/tools/InfoCard"
import { CopyableId } from "@/components/tools/CopyableId"
import { nAvaxToAvax, formatTimestamp, truncateId } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TimeProgress } from "@/components/tools/TimeProgress"
import { AlertTriangle } from "lucide-react"
import type { Validator, Delegator } from "@/lib/models/avalanche"

interface PeerInfo {
  numPeers: string
  peers: { ip: string; publicIP: string; nodeID: string; version: string; lastSent: string; lastReceived: string }[]
}

interface NodeVersionInfo {
  version: string
  databaseVersion: string
  gitCommit: string
  vmVersions: Record<string, string>
}

// Hoisted outside component to avoid re-creation on each render (rendering-hoist-jsx)
const delegatorColumns = [
  {
    key: "txID",
    label: "TX ID",
    render: (row: Delegator) => (
      <CopyableId value={row.txID} display={truncateId(row.txID, 10, 6)} className="font-mono text-xs" />
    ),
    sortValue: (row: Delegator) => row.txID,
  },
  {
    key: "stakeAmount",
    label: "Stake (AVAX)",
    render: (row: Delegator) => nAvaxToAvax(row.stakeAmount ?? row.weight, 4),
    sortValue: (row: Delegator) => Number(row.stakeAmount ?? row.weight ?? 0),
  },
  {
    key: "startTime",
    label: "Start",
    render: (row: Delegator) => formatTimestamp(row.startTime),
    sortValue: (row: Delegator) => Number(row.startTime ?? 0),
  },
  {
    key: "endTime",
    label: "End",
    render: (row: Delegator) => formatTimestamp(row.endTime),
    sortValue: (row: Delegator) => Number(row.endTime ?? 0),
  },
  {
    key: "potentialReward",
    label: "Reward (AVAX)",
    render: (row: Delegator) => nAvaxToAvax(row.potentialReward, 4),
    sortValue: (row: Delegator) => Number(row.potentialReward ?? 0),
  },
]

export default function ValidatorDashboardPage() {
  const { network } = useNetwork()
  const [nodeId, setNodeId] = useState("")
  const [validator, setValidator] = useState<Validator | null>(null)
  const [peerInfo, setPeerInfo] = useState<PeerInfo | null>(null)
  const [versionInfo, setVersionInfo] = useState<NodeVersionInfo | null>(null)
  const [validatedSubnets, setValidatedSubnets] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fetched, setFetched] = useState(false)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  async function handleLookup() {
    if (!nodeId.trim()) return
    setLoading(true)
    setError("")
    setValidator(null)
    setPeerInfo(null)
    setVersionInfo(null)
    setValidatedSubnets([])
    setFetched(false)
    clearRaw()
    try {
      const [validatorResult, peersResult, versionResult, subnetsResult] = await Promise.allSettled([
        AvalancheService.getValidatorByNodeId(network.baseUrl, nodeId.trim()),
        AvalancheService.getPeers(network.baseUrl),
        AvalancheService.getNodeVersion(network.baseUrl),
        AvalancheService.getSubnets(network.baseUrl),
      ])

      const result = validatorResult.status === "fulfilled" ? validatorResult.value : null
      if (!result) {
        setError("Validator not found for the given Node ID.")
        setFetched(true)
        setLoading(false)
        return
      }
      setValidator(result as Validator)

      if (peersResult.status === "fulfilled") {
        setPeerInfo(peersResult.value)
      }
      if (versionResult.status === "fulfilled") {
        setVersionInfo(versionResult.value)
      }

      // Check which subnets this validator participates in (async-parallel: run all lookups concurrently)
      if (subnetsResult.status === "fulfilled") {
        const subnets = subnetsResult.value
        const subnetChecks = await Promise.allSettled(
          subnets.map(async (subnet) => {
            const subnetVals = await AvalancheService.getSubnetValidators(network.baseUrl, subnet.id)
            const found = subnetVals.some(v => v.nodeID === nodeId.trim())
            return found ? subnet.id : null
          })
        )
        const matched = subnetChecks
          .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled" && r.value !== null)
          .map(r => r.value)
        setValidatedSubnets(matched)
      }

      captureRaw()
      setFetched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch validator")
      setFetched(true)
    } finally {
      setLoading(false)
    }
  }

  const delegators = validator?.delegators ?? []
  const totalDelegated = delegators.reduce(
    (sum, d) => sum + Number(d.stakeAmount ?? d.weight ?? 0) / 1e9,
    0,
  )

  return (
    <ToolCard
      title="Validator Dashboard"
      description="Comprehensive view of a validator including staking, delegations, rewards, and connected node info."
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
            Load Dashboard
          </LoadingButton>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {fetched && validator && (
          <div className="space-y-6">
            {/* Section 1: Overview */}
            <div className="space-y-3">
              <SectionHeading title="Overview" rpcMethod="platform.getCurrentValidators" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoCard label="Node ID" rpcMethod="platform.getCurrentValidators">
                  <CopyableId value={validator.nodeID} className="font-mono text-xs" />
                </InfoCard>

                <InfoCard label="Status" rpcMethod="platform.getCurrentValidators">
                  {validator.connected ? (
                    <Badge variant="default">Online</Badge>
                  ) : (
                    <Badge variant="destructive">Offline</Badge>
                  )}
                </InfoCard>

                <InfoCard label="Uptime" rpcMethod="platform.getCurrentValidators">
                  <p className="text-lg font-semibold">
                    {validator.uptime
                      ? `${parseFloat(validator.uptime).toFixed(2)}%`
                      : "N/A"}
                  </p>
                </InfoCard>

                <InfoCard label="Stake Amount" rpcMethod="platform.getCurrentValidators">
                  <p className="text-lg font-semibold">
                    {nAvaxToAvax(validator.stakeAmount ?? validator.weight, 4)} AVAX
                  </p>
                </InfoCard>

                <InfoCard label="Potential Reward" rpcMethod="platform.getCurrentValidators">
                  <p className="text-lg font-semibold">
                    {nAvaxToAvax(validator.potentialReward, 4)} AVAX
                  </p>
                </InfoCard>

                <InfoCard label="Delegation Fee" rpcMethod="platform.getCurrentValidators">
                  <p className="text-lg font-semibold">
                    {validator.delegationFee ? `${validator.delegationFee}%` : "N/A"}
                  </p>
                </InfoCard>
              </div>
            </div>

            {/* Section 2: Staking Period */}
            {validator.startTime && validator.endTime && (
              <div className="space-y-3">
                <SectionHeading title="Staking Period" rpcMethod="platform.getCurrentValidators" />
                <Card>
                  <CardContent className="pt-6">
                    <TimeProgress startTime={validator.startTime} endTime={validator.endTime} />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Section 3: Delegation Info */}
            <div className="space-y-3">
              <SectionHeading title="Delegation Info" rpcMethod="platform.getCurrentValidators" />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {delegators.length} delegator{delegators.length !== 1 ? "s" : ""}
                </p>
                <p className="text-sm font-medium">
                  Total Delegated:{" "}
                  <span className="font-semibold">
                    {totalDelegated.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    AVAX
                  </span>
                </p>
              </div>
              <DataTable
                columns={delegatorColumns}
                data={delegators as (Delegator & Record<string, unknown>)[]}
                emptyMessage="No delegators found for this validator"
              />
            </div>

            {/* Section 4: Reward Info */}
            <div className="space-y-3">
              <SectionHeading title="Reward Info" rpcMethod="platform.getCurrentValidators" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoCard label="Potential Reward">
                  <p className="text-2xl font-bold">
                    {nAvaxToAvax(validator.potentialReward, 4)} AVAX
                  </p>
                </InfoCard>
                <InfoCard label="Reward Owner Addresses">
                  {validator.validationRewardOwner?.addresses?.length ? (
                    <ul className="space-y-1">
                      {validator.validationRewardOwner.addresses.map((addr, i) => (
                        <li key={i}>
                          <CopyableId value={addr} className="font-mono text-xs" />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">N/A</p>
                  )}
                </InfoCard>
              </div>
            </div>

            {/* Section 5: Connected Node Info */}
            <div className="space-y-3">
              <SectionHeading title="Connected Node Info" rpcMethod="info.peers / info.getNodeVersion" />
              <div className="rounded-lg border bg-muted/50 p-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  This shows info about the RPC node you are connected to, not the queried validator.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InfoCard label="Peer Count" rpcMethod="info.peers">
                  <p className="text-lg font-semibold">
                    {peerInfo?.numPeers ?? "N/A"}
                  </p>
                </InfoCard>
                <InfoCard label="Node Version" rpcMethod="info.getNodeVersion">
                  {versionInfo?.version ? (
                    <CopyableId value={versionInfo.version} className="text-sm font-mono" />
                  ) : (
                    <p className="text-sm font-mono">N/A</p>
                  )}
                </InfoCard>
                <InfoCard label="Database Version" rpcMethod="info.getNodeVersion">
                  <p className="text-sm font-mono">
                    {versionInfo?.databaseVersion ?? "N/A"}
                  </p>
                </InfoCard>
              </div>
            </div>

            {/* Section 6: L1s Validated */}
            <div className="space-y-3">
              <SectionHeading title="L1s Validated" rpcMethod="platform.getSubnets" />
              {validatedSubnets.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {validatedSubnets.map((id) => (
                    <CopyableId key={id} value={id} display={truncateId(id)} className="font-mono text-xs" />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Primary network only (no additional L1s)
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </ToolCard>
  )
}
