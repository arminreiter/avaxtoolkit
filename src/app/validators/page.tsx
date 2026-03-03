"use client"

import { useEffect, useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { ToolCard } from "@/components/tools/ToolCard"
import { DataTable, Column } from "@/components/tools/DataTable"
import { InfoTooltip } from "@/components/tools/InfoTooltip"
import { CopyableId } from "@/components/tools/CopyableId"
import { Badge } from "@/components/ui/badge"
import { nAvaxToAvax, truncateId } from "@/lib/utils"
import { TableSkeleton } from "@/components/tools/TableSkeleton"
import type { Validator } from "@/lib/models/avalanche"

type ValidatorRow = Validator & Record<string, unknown>

const columns: Column<ValidatorRow>[] = [
  {
    key: "nodeID",
    label: "Node ID",
    render: (row) => (
      <CopyableId value={row.nodeID} display={truncateId(row.nodeID)} className="font-mono text-xs" />
    ),
    sortValue: (row) => row.nodeID,
  },
  {
    key: "stakeAmount",
    label: "Stake (AVAX)",
    render: (row) => nAvaxToAvax(row.stakeAmount ?? row.weight),
    sortValue: (row) => Number(row.stakeAmount ?? row.weight ?? 0),
  },
  {
    key: "delegatorCount",
    label: "Delegators",
    render: (row) =>
      row.delegatorCount ?? row.delegators?.length ?? 0,
    sortValue: (row) => row.delegatorCount ?? row.delegators?.length ?? 0,
  },
  {
    key: "uptime",
    label: "Uptime (%)",
    render: (row) => {
      if (!row.uptime) return <span className="text-muted-foreground">N/A</span>
      const pct = parseFloat(row.uptime)
      const color = pct >= 90 ? "text-green-500" : pct >= 80 ? "text-amber-500" : "text-red-500"
      return <span className={`font-semibold ${color}`}>{pct.toFixed(2)}%</span>
    },
    sortValue: (row) => row.uptime ? parseFloat(row.uptime) : -1,
  },
  {
    key: "connected",
    label: "Status",
    render: (row) =>
      row.connected ? (
        <Badge variant="default">Online</Badge>
      ) : (
        <Badge variant="destructive">Offline</Badge>
      ),
    sortValue: (row) => (row.connected ? 1 : 0),
  },
]

export default function ValidatorsOverviewPage() {
  const { network } = useNetwork()
  const [validators, setValidators] = useState<ValidatorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  useEffect(() => {
    let cancelled = false
    async function fetchValidators() {
      setLoading(true)
      setError("")
      clearRaw()
      try {
        const result = await AvalancheService.getValidators(network.baseUrl)
        if (!cancelled) {
          setValidators(result as ValidatorRow[])
          captureRaw()
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch validators")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchValidators()
    return () => {
      cancelled = true
    }
  }, [network.baseUrl, clearRaw, captureRaw])

  return (
    <ToolCard
      title="Validators Overview"
      description="Browse all current validators on the Avalanche network."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        {loading && <TableSkeleton />}

        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        {!loading && !error && (
          <>
            <div className="flex items-center gap-1.5">
              <p className="text-sm text-muted-foreground">
                {validators.length} validators
              </p>
              <InfoTooltip rpcMethod="platform.getCurrentValidators" />
            </div>
            <DataTable
              columns={columns}
              data={validators}
              emptyMessage="No validators found"
              searchPlaceholder="Search by Node ID..."
              pageSize={50}
            />
          </>
        )}
      </div>
    </ToolCard>
  )
}
