"use client"

import { useEffect, useState } from "react"
import { appLinks } from "@/lib/explorer-links"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { ToolCard } from "@/components/tools/ToolCard"
import { DataTable, Column } from "@/components/tools/DataTable"
import { InfoTooltip } from "@/components/tools/InfoTooltip"
import { CopyableId } from "@/components/tools/CopyableId"
import { truncateId, errorMessage } from "@/lib/utils"
import { TableSkeleton } from "@/components/tools/TableSkeleton"
import type { Subnet } from "@/lib/models/avalanche"

type SubnetRow = Subnet & { chains: string[] } & Record<string, unknown>

const columns: Column<SubnetRow>[] = [
  {
    key: "id",
    label: "L1 ID",
    render: (row) => (
      <CopyableId value={row.id} display={truncateId(row.id, 10, 6)} href={appLinks.l1(row.id)} explorer="l1" className="font-mono text-xs" />
    ),
    sortValue: (row) => row.id,
  },
  {
    key: "chains",
    label: "Blockchains",
    render: (row) =>
      row.chains.length ? <span>{row.chains.join(", ")}</span> : <span className="text-muted-foreground">None</span>,
    sortValue: (row) => row.chains.join(", "),
  },
  {
    key: "controlKeys",
    label: "Control Keys",
    render: (row) => (
      <span>{row.controlKeys?.length ?? 0}</span>
    ),
    sortValue: (row) => row.controlKeys?.length ?? 0,
  },
  {
    key: "threshold",
    label: "Threshold",
    render: (row) => <span>{row.threshold ?? "N/A"}</span>,
    sortValue: (row) => row.threshold ?? -1,
  },
]

function L1sOverviewPageInner() {
  const { network } = useNetwork()
  const [l1s, setL1s] = useState<SubnetRow[]>([])
  const [loading, setLoading] = useState(!network.plainRpc)
  const [error, setError] = useState("")
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  useEffect(() => {
    if (network.plainRpc) return
    let cancelled = false
    async function fetchL1s() {
      setLoading(true)
      setError("")
      clearRaw()
      try {
        const [subnets, blockchains] = await Promise.all([
          AvalancheService.getSubnets(network.baseUrl),
          AvalancheService.getBlockchains(network.baseUrl),
        ])
        if (!cancelled) {
          const chains = new Map<string, string[]>()
          for (const b of blockchains) chains.set(b.subnetID, [...(chains.get(b.subnetID) ?? []), b.name])
          setL1s(subnets.map(s => ({ ...s, chains: chains.get(s.id) ?? [] })))
          captureRaw()
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, "Failed to fetch L1s"))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchL1s()
    return () => {
      cancelled = true
    }
  }, [network.baseUrl, network.plainRpc, clearRaw, captureRaw])

  return (
    <ToolCard
      title="L1s Overview"
      description="Browse all L1s on the Avalanche network."
      rawJson={rawJson}
    >
      {network.plainRpc ? (
        <p className="text-sm text-muted-foreground">
          L1 lookups are not supported on this network (plain RPC endpoint, C-Chain only).
        </p>
      ) : (
        <div className="space-y-4">
          {loading && <TableSkeleton />}

          {error && <p className="text-destructive text-sm">{error}</p>}

          {!loading && !error && (
            <>
              <div className="flex items-center gap-1.5">
                <p className="text-sm text-muted-foreground">
                  {l1s.length} L1{l1s.length !== 1 ? "s" : ""}
                </p>
                <InfoTooltip rpcMethod="platform.getSubnets / platform.getBlockchains" />
              </div>
              <DataTable
                columns={columns}
                data={l1s}
                emptyMessage="No L1s found"
                searchPlaceholder="Search by L1 ID or blockchain name..."
                pageSize={50}
              />
            </>
          )}
        </div>
      )}
    </ToolCard>
  )
}

export default function L1sOverviewPage() {
  const { network } = useNetwork()
  return <L1sOverviewPageInner key={network.id} />
}
