"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
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
import type { Blockchain } from "@/lib/models/avalanche"

type BlockchainRow = Blockchain & Record<string, unknown>

const columns: Column<BlockchainRow>[] = [
  {
    key: "name",
    label: "Name",
    render: (row) => (
      <Link href={appLinks.blockchainStatus(row.id)} className="font-medium hover:text-primary hover:underline underline-offset-2">{row.name}</Link>
    ),
    sortValue: (row) => row.name,
  },
  {
    key: "id",
    label: "Blockchain ID",
    render: (row) => (
      <CopyableId value={row.id} display={truncateId(row.id, 10, 6)} href={appLinks.blockchainStatus(row.id)} className="font-mono text-xs" />
    ),
    sortValue: (row) => row.id,
  },
  {
    key: "subnetID",
    label: "L1 ID",
    render: (row) => (
      <CopyableId value={row.subnetID} display={truncateId(row.subnetID, 10, 6)} href={appLinks.l1(row.subnetID)} explorer="l1" className="font-mono text-xs" />
    ),
    sortValue: (row) => row.subnetID,
  },
  {
    key: "vmID",
    label: "VM ID",
    render: (row) => (
      <CopyableId value={row.vmID} display={truncateId(row.vmID, 10, 6)} className="font-mono text-xs" />
    ),
    sortValue: (row) => row.vmID,
  },
]

function BlockchainsPageInner() {
  const { network } = useNetwork()
  const [blockchains, setBlockchains] = useState<BlockchainRow[]>([])
  const [loading, setLoading] = useState(!network.plainRpc)
  const [error, setError] = useState("")
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  useEffect(() => {
    if (network.plainRpc) return
    let cancelled = false
    async function fetchBlockchains() {
      setLoading(true)
      setError("")
      clearRaw()
      try {
        const result = await AvalancheService.getBlockchains(network.baseUrl)
        if (!cancelled) {
          setBlockchains(result as BlockchainRow[])
          captureRaw()
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, "Failed to fetch blockchains"))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchBlockchains()
    return () => {
      cancelled = true
    }
  }, [network.baseUrl, network.plainRpc, clearRaw, captureRaw])

  return (
    <ToolCard
      title="Blockchains"
      description="Browse all blockchains registered on the Avalanche network."
      rawJson={rawJson}
    >
      {network.plainRpc ? (
        <p className="text-sm text-muted-foreground">
          Blockchain lookups are not supported on this network (plain RPC endpoint, C-Chain only).
        </p>
      ) : (
        <div className="space-y-4">
          {loading && <TableSkeleton />}

          {error && <p className="text-destructive text-sm">{error}</p>}

          {!loading && !error && (
            <>
              <div className="flex items-center gap-1.5">
                <p className="text-sm text-muted-foreground">
                  {blockchains.length} blockchain{blockchains.length !== 1 ? "s" : ""}
                </p>
                <InfoTooltip rpcMethod="platform.getBlockchains" />
              </div>
              <DataTable
                columns={columns}
                data={blockchains}
                emptyMessage="No blockchains found"
                searchPlaceholder="Filter by name, blockchain, L1 or VM ID..."
                pageSize={50}
              />
            </>
          )}
        </div>
      )}
    </ToolCard>
  )
}

export default function BlockchainsPage() {
  const { network } = useNetwork()
  return <BlockchainsPageInner key={network.id} />
}
