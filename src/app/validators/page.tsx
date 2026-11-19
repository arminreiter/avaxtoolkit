"use client"

import { useCallback, useEffect, useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { useNow } from "@/lib/hooks/use-now"
import { appLinks } from "@/lib/explorer-links"
import { ToolCard } from "@/components/tools/ToolCard"
import { DataTable, Column } from "@/components/tools/DataTable"
import { InfoTooltip } from "@/components/tools/InfoTooltip"
import { CopyableId } from "@/components/tools/CopyableId"
import { RefreshControl } from "@/components/tools/RefreshControl"
import { Badge } from "@/components/ui/badge"
import { nAvaxToAvax, truncateId, errorMessage, uptimeColor, timeUntil } from "@/lib/utils"
import { TableSkeleton } from "@/components/tools/TableSkeleton"
import type { Validator } from "@/lib/models/avalanche"

type ValidatorRow = Validator & Record<string, unknown>

const totalStake = (row: ValidatorRow) =>
  BigInt(row.weight ?? row.stakeAmount ?? "0") + BigInt(row.delegatorWeight ?? "0")

const columns = (now: number): Column<ValidatorRow>[] => [
  {
    key: "nodeID",
    label: "Node ID",
    render: (row) => (
      <CopyableId
        value={row.nodeID}
        display={truncateId(row.nodeID)}
        href={appLinks.validator(row.nodeID)}
        explorer="validator"
        className="font-mono text-xs"
      />
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
    key: "totalStake",
    label: "Total Stake (AVAX)",
    render: (row) => nAvaxToAvax(totalStake(row).toString()),
    sortValue: (row) => Number(totalStake(row)),
  },
  {
    key: "delegationFee",
    label: "Fee (%)",
    render: (row) => row.delegationFee ? parseFloat(row.delegationFee).toFixed(2) : "N/A",
    sortValue: (row) => row.delegationFee ? parseFloat(row.delegationFee) : -1,
  },
  {
    key: "delegatorCount",
    label: "Delegators",
    render: (row) => Number(row.delegatorCount ?? row.delegators?.length ?? 0),
    sortValue: (row) => Number(row.delegatorCount ?? row.delegators?.length ?? 0),
  },
  {
    key: "uptime",
    label: "Uptime (%)",
    render: (row) => {
      if (!row.uptime) return <span className="text-muted-foreground">N/A</span>
      const pct = parseFloat(row.uptime)
      return <span className={`font-semibold ${uptimeColor(pct)}`}>{pct.toFixed(2)}%</span>
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
  {
    key: "endTime",
    label: "Ends In",
    render: (row) => row.endTime ? timeUntil(Number(row.endTime), now) : "N/A",
    sortValue: (row) => Number(row.endTime ?? 0),
  },
]

export default function ValidatorsOverviewPage() {
  const { network } = useNetwork()
  const [validators, setValidators] = useState<ValidatorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const { rawJson, clearRaw, captureRaw } = useRawJson()
  const now = useNow(60_000)
  const refresh = useCallback(() => setReloadKey(k => k + 1), [])

  useEffect(() => {
    if (network.plainRpc) return
    let cancelled = false
    async function fetchValidators() {
      setLoading(true)
      setError("")
      clearRaw()
      try {
        const result = await AvalancheService.getValidators(network.baseUrl)
        if (!cancelled) {
          setValidators(result as ValidatorRow[])
          setUpdatedAt(Date.now())
          captureRaw()
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, "Failed to fetch validators"))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchValidators()
    return () => {
      cancelled = true
    }
  }, [network.baseUrl, network.plainRpc, reloadKey, clearRaw, captureRaw])

  return (
    <ToolCard
      title="Validators Overview"
      description="Browse all current validators on the Avalanche network."
      rawJson={rawJson}
    >
      {network.plainRpc ? (
        <p className="text-sm text-muted-foreground">
          Validator lookups are not supported on this network (plain RPC endpoint, C-Chain only).
        </p>
      ) : (
      <div className="space-y-4">
        <div className="flex justify-end">
          <RefreshControl updatedAt={updatedAt} loading={loading} onRefresh={refresh} />
        </div>
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
              columns={columns(now)}
              data={validators}
              emptyMessage="No validators found"
              searchPlaceholder="Search by Node ID..."
              pageSize={50}
            />
          </>
        )}
      </div>
      )}
    </ToolCard>
  )
}
