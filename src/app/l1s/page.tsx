"use client"

import { useEffect, useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { ToolCard } from "@/components/tools/ToolCard"
import { DataTable, Column } from "@/components/tools/DataTable"
import { InfoTooltip } from "@/components/tools/InfoTooltip"
import { CopyableId } from "@/components/tools/CopyableId"
import { truncateId } from "@/lib/utils"
import { TableSkeleton } from "@/components/tools/TableSkeleton"
import type { Subnet } from "@/lib/models/avalanche"

type SubnetRow = Subnet & Record<string, unknown>

const columns: Column<SubnetRow>[] = [
  {
    key: "id",
    label: "L1 ID",
    render: (row) => (
      <CopyableId value={row.id} display={truncateId(row.id, 10, 6)} className="font-mono text-xs" />
    ),
    sortValue: (row) => row.id,
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

export default function L1sOverviewPage() {
  const { network } = useNetwork()
  const [l1s, setL1s] = useState<SubnetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  useEffect(() => {
    let cancelled = false
    async function fetchL1s() {
      setLoading(true)
      setError("")
      clearRaw()
      try {
        const result = await AvalancheService.getSubnets(network.baseUrl)
        if (!cancelled) {
          setL1s(result as SubnetRow[])
          captureRaw()
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch L1s")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchL1s()
    return () => {
      cancelled = true
    }
  }, [network.baseUrl, clearRaw, captureRaw])

  return (
    <ToolCard
      title="L1s Overview"
      description="Browse all L1s on the Avalanche network."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        {loading && <TableSkeleton />}

        {error && <p className="text-destructive text-sm">{error}</p>}

        {!loading && !error && (
          <>
            <div className="flex items-center gap-1.5">
              <p className="text-sm text-muted-foreground">
                {l1s.length} L1{l1s.length !== 1 ? "s" : ""}
              </p>
              <InfoTooltip rpcMethod="platform.getSubnets" />
            </div>
            <DataTable
              columns={columns}
              data={l1s}
              emptyMessage="No L1s found"
              searchPlaceholder="Search by L1 ID..."
              pageSize={50}
            />
          </>
        )}
      </div>
    </ToolCard>
  )
}
