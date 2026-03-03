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
import { CopyableId } from "@/components/tools/CopyableId"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface NodeInfo {
  nodeID: string | null
  nodeIP: string | null
  networkID: string | null
  networkName: string | null
  version: string | null
  databaseVersion: string | null
  gitCommit: string | null
}

interface BootstrapStatus {
  P: boolean | null
  X: boolean | null
  C: boolean | null
}

export default function NodeInfoPage() {
  const { network } = useNetwork()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [nodeInfo, setNodeInfo] = useState<NodeInfo | null>(null)
  const [bootstrap, setBootstrap] = useState<BootstrapStatus | null>(null)
  const [vms, setVMs] = useState<Record<string, string[]> | null>(null)
  const [upgrades, setUpgrades] = useState<Record<string, unknown> | null>(null)
  const [acps, setACPs] = useState<Record<string, unknown> | null>(null)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  const fetchInfo = useCallback(async () => {
    setLoading(true)
    setError("")
    setNodeInfo(null)
    setBootstrap(null)
    setVMs(null)
    setUpgrades(null)
    setACPs(null)
    clearRaw()

    try {
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
      ] = await Promise.allSettled([
        AvalancheService.getNodeId(network.baseUrl),
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
      ])

      setNodeInfo({
        nodeID:
          nodeIdResult.status === "fulfilled"
            ? nodeIdResult.value.nodeID
            : null,
        nodeIP:
          nodeIPResult.status === "fulfilled"
            ? nodeIPResult.value.ip
            : null,
        networkID:
          networkIDResult.status === "fulfilled"
            ? networkIDResult.value.networkID
            : null,
        networkName:
          networkNameResult.status === "fulfilled"
            ? networkNameResult.value.networkName
            : null,
        version:
          versionResult.status === "fulfilled"
            ? versionResult.value.version
            : null,
        databaseVersion:
          versionResult.status === "fulfilled"
            ? versionResult.value.databaseVersion
            : null,
        gitCommit:
          versionResult.status === "fulfilled"
            ? versionResult.value.gitCommit
            : null,
      })

      setBootstrap({
        P:
          bootstrapP.status === "fulfilled"
            ? bootstrapP.value.isBootstrapped
            : null,
        X:
          bootstrapX.status === "fulfilled"
            ? bootstrapX.value.isBootstrapped
            : null,
        C:
          bootstrapC.status === "fulfilled"
            ? bootstrapC.value.isBootstrapped
            : null,
      })

      if (vmsResult.status === "fulfilled") {
        setVMs(vmsResult.value.vms)
      }

      if (upgradesResult.status === "fulfilled") {
        setUpgrades(upgradesResult.value)
      }

      if (acpsResult.status === "fulfilled") {
        setACPs(acpsResult.value)
      }

      captureRaw()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch node info",
      )
    } finally {
      setLoading(false)
    }
  }, [network.baseUrl, clearRaw, captureRaw])

  const infoCards: { label: string; value: string | null; rpcMethod: string; mono?: boolean }[] = nodeInfo
    ? [
        { label: "Node ID", value: nodeInfo.nodeID, rpcMethod: "info.getNodeID", mono: true },
        { label: "Node IP", value: nodeInfo.nodeIP, rpcMethod: "info.getNodeIP", mono: true },
        { label: "Network ID", value: nodeInfo.networkID, rpcMethod: "info.getNetworkID" },
        { label: "Network Name", value: nodeInfo.networkName, rpcMethod: "info.getNetworkName" },
        { label: "Node Version", value: nodeInfo.version, rpcMethod: "info.getNodeVersion", mono: true },
        { label: "Database Version", value: nodeInfo.databaseVersion, rpcMethod: "info.getNodeVersion", mono: true },
        { label: "Git Commit", value: nodeInfo.gitCommit, rpcMethod: "info.getNodeVersion", mono: true },
      ]
    : []

  return (
    <ToolCard
      title="Node Info"
      description="View identity, version, bootstrap status, installed VMs, and upgrade schedule for the connected node."
      rawJson={rawJson}
    >
      <div className="space-y-6">
        <LoadingButton loading={loading} onClick={fetchInfo}>
          Fetch Node Info
        </LoadingButton>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {nodeInfo && (
          <div className="space-y-6">
            {/* Identity & Version Cards */}
            <div className="space-y-3">
              <SectionHeading title="Identity & Version" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {infoCards.map((card) => (
                  <InfoCard key={card.label} label={card.label} rpcMethod={card.rpcMethod}>
                    {card.value && card.mono ? (
                      <CopyableId value={card.value} className="text-sm font-mono" />
                    ) : (
                      <p className={`text-sm break-all ${card.mono ? "font-mono" : ""}`}>
                        {card.value ?? "N/A"}
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
                        {bootstrap[chain] === null ? (
                          <span className="text-sm text-muted-foreground">Unavailable</span>
                        ) : bootstrap[chain] ? (
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
                <OutputDisplay
                  label="Upgrade Schedule"
                  value={JSON.stringify(upgrades, null, 2)}
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
