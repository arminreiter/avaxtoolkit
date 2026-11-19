"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { useWallet } from "@/lib/contexts/wallet-context"
import { hrpForNetwork } from "@/lib/models/network"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { useQueryParam } from "@/lib/hooks/use-query-param"
import { avaxAddressFromWallet } from "@/lib/utils/wallet"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { DataTable } from "@/components/tools/DataTable"
import { InfoTooltip } from "@/components/tools/InfoTooltip"
import { CopyableId } from "@/components/tools/CopyableId"
import { normalizeXChainAddress, errorMessage, formatTokenAmount } from "@/lib/utils"
import { TableSkeleton } from "@/components/tools/TableSkeleton"

interface Balance {
  asset: string
  balance: string
  symbol?: string
  name?: string
  denomination?: number
}

type AssetDescription = Awaited<ReturnType<typeof AvalancheService.getAssetDescription>>

// ponytail: module-level cache, asset metadata is immutable; lives until page reload
const assetCache = new Map<string, Promise<AssetDescription | null>>()

function describeAsset(baseUrl: string, assetID: string) {
  const key = `${baseUrl}|${assetID}`
  let p = assetCache.get(key)
  if (!p) {
    p = AvalancheService.getAssetDescription(baseUrl, assetID).catch(() => null)
    assetCache.set(key, p)
  }
  return p
}

function XChainBalancePageInner() {
  const { network } = useNetwork()
  const { activeWallet } = useWallet()
  const [param, setParam] = useQueryParam("address")
  const [address, setAddress] = useState(param)
  const [balances, setBalances] = useState<Balance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fetched, setFetched] = useState(false)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  // Prefill the active wallet's X address once it loads, unless the user already typed something
  const walletId = activeWallet?.id ?? ""
  const [prevWalletId, setPrevWalletId] = useState("")
  if (walletId !== prevWalletId) {
    setPrevWalletId(walletId)
    if (!address && activeWallet) {
      const bare = avaxAddressFromWallet(activeWallet, hrpForNetwork(network))
      if (bare) setAddress(`X-${bare}`)
    }
  }

  const lookup = useCallback(async (addr: string) => {
    setLoading(true)
    setError("")
    setBalances([])
    setFetched(true)
    clearRaw()
    try {
      const result = await AvalancheService.getXChainBalances(network.baseUrl, addr)
      captureRaw()
      const descriptions = await Promise.all(result.map(b => describeAsset(network.baseUrl, b.asset)))
      setBalances(result.map((b, i) => ({ ...b, ...descriptions[i] })))
    } catch (err) {
      setError(errorMessage(err, "Failed to fetch balances"))
    } finally {
      setLoading(false)
    }
  }, [network.baseUrl, clearRaw, captureRaw])

  // Deep links and back/forward: run whenever the URL param changes
  useEffect(() => {
    if (param && !network.plainRpc) Promise.resolve().then(() => lookup(normalizeXChainAddress(param)))
  }, [param, lookup, network.plainRpc])

  function handleSubmit() {
    const addr = normalizeXChainAddress(address)
    if (!addr) {
      setError("Please enter an address")
      return
    }
    if (addr === param) lookup(addr)
    else setParam(addr)
  }

  const columns = [
    {
      key: "asset",
      label: "Asset",
      render: (row: Balance) => (
        <div className="space-y-0.5">
          {row.symbol && (
            <p className="font-medium">
              {row.symbol} <span className="text-muted-foreground font-normal">{row.name}</span>
            </p>
          )}
          <CopyableId value={row.asset} className="font-mono text-xs text-muted-foreground" />
        </div>
      ),
      sortValue: (row: Balance) => row.symbol ?? row.asset,
    },
    {
      key: "balance",
      label: "Balance",
      render: (row: Balance) => (
        <span className="font-mono">
          {formatTokenAmount(BigInt(row.balance), row.denomination ?? 0)}
          {row.denomination === undefined && <span className="text-muted-foreground text-xs"> (raw)</span>}
        </span>
      ),
      sortValue: (row: Balance) => Number(row.balance) / 10 ** (row.denomination ?? 0),
    },
  ]

  return (
    <ToolCard
      title="X-Chain Balance"
      description="Look up all asset balances for an X-Chain address."
      rawJson={rawJson}
    >
      {network.plainRpc ? (
        <p className="text-sm text-muted-foreground">
          X-Chain lookups are not supported on this network (plain RPC endpoint, C-Chain only).
        </p>
      ) : (
        <div className="space-y-4">
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSubmit() }}>
            <FormField
              label="X-Chain Address"
              id="x-chain-address"
              value={address}
              onChange={setAddress}
              placeholder={`X-${hrpForNetwork(network)}1... or ${hrpForNetwork(network)}1...`}
              monospace
            />
            <LoadingButton type="submit" loading={loading}>
              Look Up Balances
            </LoadingButton>
          </form>

          {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

          {loading && <TableSkeleton rows={3} />}

          {!loading && !error && fetched && (
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
                searchPlaceholder="Search assets..."
              />
            </>
          )}
        </div>
      )}
    </ToolCard>
  )
}

export default function XChainBalancePage() {
  const { network } = useNetwork()
  return <Suspense fallback={null}><XChainBalancePageInner key={network.id} /></Suspense>
}
