"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { useQueryParam } from "@/lib/hooks/use-query-param"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { DataTable, Column } from "@/components/tools/DataTable"
import { InfoTooltip } from "@/components/tools/InfoTooltip"
import { CopyableId } from "@/components/tools/CopyableId"
import { Badge } from "@/components/ui/badge"
import { nAvaxToAvax, truncateId, errorMessage, uptimeColor } from "@/lib/utils"
import { TableSkeleton } from "@/components/tools/TableSkeleton"
import type { Validator } from "@/lib/models/avalanche"

type ValidatorRow = Validator & Record<string, unknown>

const PRIMARY_NETWORK_ID = "11111111111111111111111111111111LpoYY"

const nodeIdColumn: Column<ValidatorRow> = {
  key: "nodeID",
  label: "Node ID",
  render: (row) => (
    <CopyableId value={row.nodeID} display={truncateId(row.nodeID)} explorer="validator" className="font-mono text-xs" />
  ),
  sortValue: (row) => row.nodeID,
}

const validationIdColumn: Column<ValidatorRow> = {
  key: "validationID",
  label: "Validation ID",
  render: (row) =>
    row.validationID ? (
      <CopyableId value={row.validationID} display={truncateId(row.validationID, 10, 6)} className="font-mono text-xs" />
    ) : null,
  sortValue: (row) => row.validationID ?? "",
}

// Primary network weight is staked nAVAX; L1 weight is a unitless consensus weight.
function weightColumn(isPrimary: boolean): Column<ValidatorRow> {
  return {
    key: "weight",
    label: isPrimary ? "Stake (AVAX)" : "Weight",
    render: (row) =>
      isPrimary ? nAvaxToAvax(row.stakeAmount ?? row.weight) : BigInt(row.weight ?? 0).toLocaleString(),
    sortValue: (row) => Number(isPrimary ? row.stakeAmount ?? row.weight ?? 0 : row.weight ?? 0),
  }
}

const balanceColumn: Column<ValidatorRow> = {
  key: "balance",
  label: "Balance (AVAX)",
  render: (row) => (row.balance !== undefined ? nAvaxToAvax(row.balance) : null),
  sortValue: (row) => Number(row.balance ?? 0),
}

const uptimeColumn: Column<ValidatorRow> = {
  key: "uptime",
  label: "Uptime (%)",
  render: (row) => {
    if (!row.uptime) return <span className="text-muted-foreground">N/A</span>
    const pct = parseFloat(row.uptime)
    return <span className={`font-semibold ${uptimeColor(pct)}`}>{pct.toFixed(2)}%</span>
  },
  sortValue: (row) => row.uptime ? parseFloat(row.uptime) : -1,
}

const statusColumn: Column<ValidatorRow> = {
  key: "connected",
  label: "Status",
  render: (row) =>
    row.connected ? (
      <Badge variant="default">Online</Badge>
    ) : (
      <Badge variant="destructive">Offline</Badge>
    ),
  sortValue: (row) => (row.connected ? 1 : 0),
}

function buildColumns(subnetId: string, rows: ValidatorRow[]): Column<ValidatorRow>[] {
  const hasValidationId = rows.some(r => r.validationID)
  const hasBalance = rows.some(r => r.balance !== undefined)
  const hasUptime = rows.some(r => r.uptime)
  return [
    nodeIdColumn,
    ...(hasValidationId ? [validationIdColumn] : []),
    weightColumn(subnetId === PRIMARY_NETWORK_ID),
    ...(hasBalance ? [balanceColumn] : []),
    ...(hasUptime ? [uptimeColumn] : []),
    statusColumn,
  ]
}

function L1ValidatorsPageInner() {
  const { network } = useNetwork()
  const [param, setParam] = useQueryParam("l1")
  const [l1Id, setL1Id] = useState(param)
  const [validators, setValidators] = useState<ValidatorRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fetched, setFetched] = useState(false)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  const lookup = useCallback(async (id: string) => {
    setLoading(true)
    setError("")
    setValidators([])
    setFetched(true)
    clearRaw()
    try {
      const result = await AvalancheService.getSubnetValidators(network.baseUrl, id)
      setValidators(result as ValidatorRow[])
      captureRaw()
    } catch (err) {
      setError(errorMessage(err, "Failed to fetch validators"))
    } finally {
      setLoading(false)
    }
  }, [network.baseUrl, clearRaw, captureRaw])

  // Deep links and back/forward: run whenever the URL param changes
  useEffect(() => {
    if (param && !network.plainRpc) Promise.resolve().then(() => lookup(param))
  }, [param, lookup, network.plainRpc])

  function handleSubmit() {
    const id = l1Id.trim()
    if (!id) return
    if (id === param) lookup(id)
    else setParam(id)
  }

  return (
    <ToolCard
      title="L1 Validators"
      description="View validators for a specific L1."
      rawJson={rawJson}
    >
      {network.plainRpc ? (
        <p className="text-sm text-muted-foreground">
          L1 lookups are not supported on this network (plain RPC endpoint, C-Chain only).
        </p>
      ) : (
        <div className="space-y-4">
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSubmit() }}>
            <FormField
              label="L1 ID"
              id="l1-validator-id"
              value={l1Id}
              onChange={setL1Id}
              placeholder="Enter L1 ID..."
              monospace
            />
            <LoadingButton type="submit" loading={loading}>
              Fetch Validators
            </LoadingButton>
          </form>

          {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

          {loading && <TableSkeleton rows={4} />}

          {!loading && !error && fetched && (
            <>
              <div className="flex items-center gap-1.5">
                <p className="text-sm text-muted-foreground">
                  {validators.length} validator{validators.length !== 1 ? "s" : ""}
                </p>
                <InfoTooltip rpcMethod="platform.getCurrentValidators" />
              </div>
              <DataTable
                columns={buildColumns(param, validators)}
                data={validators}
                emptyMessage="No validators found for this L1"
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

export default function L1ValidatorsPage() {
  const { network } = useNetwork()
  return <Suspense fallback={null}><L1ValidatorsPageInner key={network.id} /></Suspense>
}
