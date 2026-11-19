"use client"

import { useState, useCallback, useEffect } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { useNow } from "@/lib/hooks/use-now"
import { ToolCard } from "@/components/tools/ToolCard"
import { OutputDisplay } from "@/components/tools/OutputDisplay"
import { SectionHeading } from "@/components/tools/SectionHeading"
import { InfoCard } from "@/components/tools/InfoCard"
import { CopyableId } from "@/components/tools/CopyableId"
import { DataTable } from "@/components/tools/DataTable"
import { RefreshControl } from "@/components/tools/RefreshControl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { appLinks } from "@/lib/explorer-links"
import { errorMessage, formatTimestamp } from "@/lib/utils"

/** A settled value, or the reason it failed. */
interface Field<T> {
  value: T | null
  error?: string
}

interface NodeInfo {
  nodeID: Field<string>
  nodeIP: Field<string>
  networkID: Field<string>
  networkName: Field<string>
  version: Field<string>
  databaseVersion: Field<string>
  gitCommit: Field<string>
}

interface BootstrapStatus {
  P: Field<boolean>
  X: Field<boolean>
  C: Field<boolean>
}

type UpgradeRow = { name: string; time: number | null; value: string } & Record<string, unknown>

function field<T, R>(result: PromiseSettledResult<T>, pick: (v: T) => R): Field<R> {
  return result.status === "fulfilled"
    ? { value: pick(result.value) }
    : { value: null, error: errorMessage(result.reason, "Request failed") }
}

/** info.upgrades returns ISO timestamps under `*Time` keys plus a few non-time params. */
function upgradeRows(upgrades: Record<string, unknown>): UpgradeRow[] {
  return Object.entries(upgrades).map(([name, v]) => {
    const ms = name.endsWith("Time") && typeof v === "string" ? Date.parse(v) : NaN
    return { name, time: Number.isNaN(ms) ? null : ms / 1000, value: String(v) }
  })
}

function UpgradeStatus({ time }: { time: number }) {
  const now = useNow(60000)
  // AvalancheGo marks unscheduled upgrades with a far-future date (year 9999).
  if (new Date(time * 1000).getUTCFullYear() >= 9000) return <Badge variant="outline">Unscheduled</Badge>
  return time * 1000 <= now
    ? <Badge variant="secondary">Activated</Badge>
    : <Badge variant="default">Upcoming</Badge>
}

function NodeInfoPageInner() {
  const { network } = useNetwork()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null)
  const [bootstrap, setBootstrap] = useState<BootstrapStatus | null>(null)
  const [vms, setVMs] = useState<Record<string, string[]> | null>(null)
  const [upgrades, setUpgrades] = useState<Record<string, unknown> | null>(null)
  const [acps, setACPs] = useState<Record<string, unknown> | null>(null)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  const fetchInfo = useCallback(async () => {
    setLoading(true)
    setError("")
    clearRaw()

    const results = await Promise.allSettled([
      AvalancheService.getNodeID(network.baseUrl),
      AvalancheService.getNodeIP(network.baseUrl),
      AvalancheService.getNetworkID(network.baseUrl),
      AvalancheService.getNetworkName(network.baseUrl),
      AvalancheService.getNodeVersion(network.baseUrl),
      AvalancheService.isBootstrapped(network.baseUrl, "P"),
      AvalancheService.isBootstrapped(network.baseUrl, "X"),
      AvalancheService.isBootstrapped(network.baseUrl, "C"),
      AvalancheService.getVMs(network.baseUrl),
      AvalancheService.getUpgrades(network.baseUrl),
      AvalancheService.getACPs(network.baseUrl),
    ] as const)
    const [
      nodeIdResult,
      nodeIPResult,
      networkIDResult,
      networkNameResult,
      versionResult,
      bootstrapP,
      bootstrapX,
      bootstrapC,
      vmsResult,
      upgradesResult,
      acpsResult,
    ] = results

    const firstRejection = results.find((r) => r.status === "rejected")
    if (firstRejection && results.every((r) => r.status === "rejected")) {
      setError(errorMessage(firstRejection.reason, "Failed to fetch node info. The node may be unreachable."))
      setNodeInfo(null)
      setBootstrap(null)
      setVMs(null)
      setUpgrades(null)
      setACPs(null)
      setLoading(false)
      return
    }

    setNodeInfo({
      nodeID: field(nodeIdResult, (v) => v.nodeID),
      nodeIP: field(nodeIPResult, (v) => v.ip),
      networkID: field(networkIDResult, (v) => v.networkID),
      networkName: field(networkNameResult, (v) => v.networkName),
      version: field(versionResult, (v) => v.version),
      databaseVersion: field(versionResult, (v) => v.databaseVersion),
      gitCommit: field(versionResult, (v) => v.gitCommit),
    })
    setBootstrap({
      P: field(bootstrapP, (v) => v.isBootstrapped),
      X: field(bootstrapX, (v) => v.isBootstrapped),
      C: field(bootstrapC, (v) => v.isBootstrapped),
    })
    setVMs(vmsResult.status === "fulfilled" ? vmsResult.value.vms : null)
    setUpgrades(upgradesResult.status === "fulfilled" ? upgradesResult.value : null)
    setACPs(acpsResult.status === "fulfilled" ? acpsResult.value : null)
    setUpdatedAt(Date.now())
    captureRaw()
    setLoading(false)
  }, [network.baseUrl, clearRaw, captureRaw])

  useEffect(() => {
    if (!network.plainRpc) Promise.resolve().then(fetchInfo)
  }, [fetchInfo, network.plainRpc])

  if (network.plainRpc) {
    return (
      <ToolCard
        title="Node Info"
        description="View identity, version, bootstrap status, installed VMs, and upgrade schedule for the connected node."
      >
        <p className="text-sm text-muted-foreground">
          Not supported on this network (plain JSON-RPC endpoint).
        </p>
      </ToolCard>
    )
  }

  const infoCards: { label: string; field: Field<string>; rpcMethod: string; mono?: boolean; nodeId?: boolean }[] = nodeInfo
    ? [
        { label: "Node ID", field: nodeInfo.nodeID, rpcMethod: "info.getNodeID", mono: true, nodeId: true },
        { label: "Node IP", field: nodeInfo.nodeIP, rpcMethod: "info.getNodeIP", mono: true },
        { label: "Network ID", field: nodeInfo.networkID, rpcMethod: "info.getNetworkID" },
        { label: "Network Name", field: nodeInfo.networkName, rpcMethod: "info.getNetworkName" },
        { label: "Node Version", field: nodeInfo.version, rpcMethod: "info.getNodeVersion", mono: true },
        { label: "Database Version", field: nodeInfo.databaseVersion, rpcMethod: "info.getNodeVersion", mono: true },
        { label: "Git Commit", field: nodeInfo.gitCommit, rpcMethod: "info.getNodeVersion", mono: true },
      ]
    : []

  return (
    <ToolCard
      title="Node Info"
      description="View identity, version, bootstrap status, installed VMs, and upgrade schedule for the connected node."
      rawJson={rawJson}
    >
      <div className="space-y-6">
        <RefreshControl updatedAt={updatedAt} loading={loading} onRefresh={fetchInfo} />

        {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

        {nodeInfo && (
          <div className="space-y-6">
            {/* Identity & Version Cards */}
            <div className="space-y-3">
              <SectionHeading title="Identity & Version" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {infoCards.map((card) => (
                  <InfoCard key={card.label} label={card.label} rpcMethod={card.rpcMethod}>
                    {card.field.value && card.mono ? (
                      <CopyableId
                        value={card.field.value}
                        className="text-sm font-mono"
                        href={card.nodeId ? appLinks.validator(card.field.value) : undefined}
                        explorer={card.nodeId ? "validator" : undefined}
                      />
                    ) : (
                      <p className={`text-sm break-all ${card.mono ? "font-mono" : ""}`} title={card.field.error}>
                        {card.field.value ?? "N/A"}
                      </p>
                    )}
                  </InfoCard>
                ))}
              </div>
            </div>

            {/* Bootstrap Status */}
            {bootstrap && (
              <div className="space-y-3">
                <SectionHeading title="Bootstrap Status" rpcMethod="info.isBootstrapped" />
                <div className="grid grid-cols-3 gap-4">
                  {(["P", "X", "C"] as const).map((chain) => (
                    <Card key={chain}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {chain}-Chain
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {bootstrap[chain].value === null ? (
                          <span className="text-sm text-muted-foreground" title={bootstrap[chain].error}>Unavailable</span>
                        ) : bootstrap[chain].value ? (
                          <Badge variant="default">Bootstrapped</Badge>
                        ) : (
                          <Badge variant="destructive">Syncing</Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Installed VMs */}
            {vms && Object.keys(vms).length > 0 && (
              <div className="space-y-3">
                <SectionHeading title="Installed VMs" rpcMethod="info.getVMs" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(vms).map(([vmID, aliases]) => (
                    <Card key={vmID}>
                      <CardHeader className="pb-2">
                        <CopyableId value={vmID} className="text-xs font-mono text-muted-foreground truncate" />
                      </CardHeader>
                      <CardContent>
                        {aliases.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {aliases.map((alias) => (
                              <Badge key={alias} variant="secondary" className="text-xs">
                                {alias}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No aliases</span>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Network Upgrades */}
            {upgrades && Object.keys(upgrades).length > 0 && (
              <div className="space-y-3">
                <SectionHeading title="Network Upgrades" rpcMethod="info.upgrades" />
                <DataTable<UpgradeRow>
                  data={upgradeRows(upgrades)}
                  rowKey={(row) => row.name}
                  columns={[
                    { key: "name", label: "Upgrade", render: (row) => <span className="font-mono text-xs">{row.name}</span> },
                    {
                      key: "time",
                      label: "Activation",
                      sortValue: (row) => row.time ?? Number.MAX_SAFE_INTEGER,
                      render: (row) => <span className="font-mono text-xs">{row.time === null ? row.value : formatTimestamp(row.time)}</span>,
                    },
                    {
                      key: "status",
                      label: "Status",
                      sortValue: (row) => row.time ?? Number.MAX_SAFE_INTEGER,
                      render: (row) => (row.time === null ? null : <UpgradeStatus time={row.time} />),
                    },
                  ]}
                />
              </div>
            )}

            {/* ACPs */}
            {acps && Object.keys(acps).length > 0 && (
              <div className="space-y-3">
                <SectionHeading title="Avalanche Community Proposals" rpcMethod="info.acps" />
                <OutputDisplay
                  label="ACPs"
                  value={JSON.stringify(acps, null, 2)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </ToolCard>
  )
}

export default function NodeInfoPage() {
  const { network } = useNetwork()
  // Remount on network switch so the previous network's results never linger.
  return <NodeInfoPageInner key={network.id} />
}
