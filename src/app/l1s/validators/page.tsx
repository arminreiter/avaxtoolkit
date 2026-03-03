"use client"

import { useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
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

export default function L1ValidatorsPage() {
  const { network } = useNetwork()
  const [l1Id, setL1Id] = useState("")
  const [validators, setValidators] = useState<ValidatorRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [hasSearched, setHasSearched] = useState(false)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  async function handleLookup() {
    if (!l1Id.trim()) return
    setLoading(true)
    setError("")
    setValidators([])
    setHasSearched(true)
    clearRaw()
    try {
      const result = await AvalancheService.getSubnetValidators(
        network.baseUrl,
        l1Id.trim(),
      )
      setValidators(result as ValidatorRow[])
      captureRaw()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch validators")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ToolCard
      title="L1 Validators"
      description="View validators for a specific L1."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <FormField
          label="L1 ID"
          id="l1-validator-id"
          value={l1Id}
          onChange={setL1Id}
          placeholder="Enter L1 ID..."
          monospace
        />
        <LoadingButton loading={loading} onClick={handleLookup}>
          Fetch Validators
        </LoadingButton>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {loading && <TableSkeleton rows={4} />}

        {!loading && !error && hasSearched && (
          <>
            <div className="flex items-center gap-1.5">
              <p className="text-sm text-muted-foreground">
                {validators.length} validator{validators.length !== 1 ? "s" : ""}
              </p>
              <InfoTooltip rpcMethod="platform.getCurrentValidators" />
            </div>
            <DataTable
              columns={columns}
              data={validators}
              emptyMessage="No validators found for this L1"
              searchPlaceholder="Search by Node ID..."
              pageSize={50}
            />
          </>
        )}
      </div>
    </ToolCard>
  )
}
