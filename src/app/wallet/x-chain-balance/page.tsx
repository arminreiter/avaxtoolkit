"use client"

import { useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { DataTable } from "@/components/tools/DataTable"
import { InfoTooltip } from "@/components/tools/InfoTooltip"
import { CopyableId } from "@/components/tools/CopyableId"
import { normalizeXChainAddress } from "@/lib/utils"
import { TableSkeleton } from "@/components/tools/TableSkeleton"

interface Balance {
  asset: string
  balance: string
}

export default function XChainBalancePage() {
  const { network } = useNetwork()
  const [address, setAddress] = useState("")
  const [balances, setBalances] = useState<Balance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [hasSearched, setHasSearched] = useState(false)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  async function handleLookup() {
    if (!address.trim()) return
    setLoading(true)
    setError("")
    setBalances([])
    setHasSearched(true)
    clearRaw()
    try {
      const result = await AvalancheService.getXChainBalances(
        network.baseUrl,
        normalizeXChainAddress(address),
      )
      setBalances(result)
      captureRaw()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch balances")
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: "asset",
      label: "Asset ID",
      render: (row: Balance) => (
        <CopyableId value={row.asset} className="font-mono text-xs" />
      ),
      sortValue: (row: Balance) => row.asset,
    },
    {
      key: "balance",
      label: "Balance",
      render: (row: Balance) => (
        <span className="font-mono">{Number(row.balance).toLocaleString()}</span>
      ),
      sortValue: (row: Balance) => Number(row.balance),
    },
  ]

  return (
    <ToolCard
      title="X-Chain Balance"
      description="Look up all asset balances for an X-Chain address."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <FormField
          label="X-Chain Address"
          id="x-chain-address"
          value={address}
          onChange={setAddress}
          placeholder="X-avax1... or avax1..."
          monospace
        />
        <LoadingButton loading={loading} onClick={handleLookup}>
          Look Up Balances
        </LoadingButton>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {loading && <TableSkeleton rows={3} />}

        {!loading && !error && hasSearched && (
          <>
            <div className="flex items-center gap-1.5">
              <p className="text-sm text-muted-foreground">
                {balances.length} asset{balances.length !== 1 ? "s" : ""}
              </p>
              <InfoTooltip rpcMethod="avm.getAllBalances" />
            </div>
            <DataTable
              columns={columns}
              data={balances as (Balance & Record<string, unknown>)[]}
              emptyMessage="No balances found for this address"
              searchPlaceholder="Search by asset ID..."
            />
          </>
        )}
      </div>
    </ToolCard>
  )
}
