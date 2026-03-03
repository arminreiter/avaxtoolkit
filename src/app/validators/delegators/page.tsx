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
import { formatUnits } from "ethers"
import { nAvaxToAvax, formatTimestamp, truncateId } from "@/lib/utils"
import type { Delegator, Validator } from "@/lib/models/avalanche"

type DelegatorRow = Delegator & Record<string, unknown>

const columns: Column<DelegatorRow>[] = [
  {
    key: "txID",
    label: "TX ID",
    render: (row) => (
      <CopyableId value={row.txID} display={truncateId(row.txID, 10, 6)} className="font-mono text-xs" />
    ),
    sortValue: (row) => row.txID,
  },
  {
    key: "stakeAmount",
    label: "Stake Amount (AVAX)",
    render: (row) => nAvaxToAvax(row.stakeAmount ?? row.weight),
    sortValue: (row) => Number(row.stakeAmount ?? row.weight ?? 0),
  },
  {
    key: "startTime",
    label: "Start Date",
    render: (row) => formatTimestamp(row.startTime, "date"),
    sortValue: (row) => Number(row.startTime ?? 0),
  },
  {
    key: "endTime",
    label: "End Date",
    render: (row) => formatTimestamp(row.endTime, "date"),
    sortValue: (row) => Number(row.endTime ?? 0),
  },
  {
    key: "potentialReward",
    label: "Potential Reward (AVAX)",
    render: (row) => nAvaxToAvax(row.potentialReward),
    sortValue: (row) => Number(row.potentialReward ?? 0),
  },
]

export default function DelegatorsPage() {
  const { network } = useNetwork()
  const [nodeId, setNodeId] = useState("")
  const [delegators, setDelegators] = useState<DelegatorRow[]>([])
  const [totalDelegated, setTotalDelegated] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fetched, setFetched] = useState(false)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  async function handleLookup() {
    if (!nodeId.trim()) return
    setLoading(true)
    setError("")
    setDelegators([])
    setTotalDelegated(0)
    setFetched(false)
    clearRaw()
    try {
      const result = await AvalancheService.getValidatorByNodeId(
        network.baseUrl,
        nodeId.trim()
      )
      if (!result) {
        setError("Validator not found for the given Node ID.")
      } else {
        const v = result as Validator
        const dels = (v.delegators ?? []) as DelegatorRow[]
        setDelegators(dels)
        const total = dels.reduce(
          (sum, d) => sum + parseFloat(formatUnits(d.stakeAmount ?? d.weight ?? "0", 9)),
          0
        )
        setTotalDelegated(total)
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

  return (
    <ToolCard
      title="Delegators"
      description="View all delegators for a specific validator by Node ID."
      rawJson={rawJson}
    >
      <div className="space-y-4">
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
            Fetch Delegators
          </LoadingButton>
        </div>

        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        {fetched && !error && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-sm text-muted-foreground">
                  {delegators.length} delegator{delegators.length !== 1 ? "s" : ""} found
                </p>
                <InfoTooltip rpcMethod="platform.getCurrentValidators" />
              </div>
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
              columns={columns}
              data={delegators}
              emptyMessage="No delegators found for this validator"
              searchPlaceholder="Search by TX ID..."
              pageSize={50}
            />
          </div>
        )}
      </div>
    </ToolCard>
  )
}
